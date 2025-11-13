"""성경 XML 파일을 Supabase 벡터 DB에 적재하는 스크립트"""
import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 환경변수 로드
load_dotenv()

# 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_TABLE_NAME = os.getenv("SUPABASE_TABLE_NAME", "bible_chunks")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "1536"))  # output_dimensionality 파라미터 사용

# Google API 키 환경변수 설정 (langchain-google-genai가 자동으로 사용)
if GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

# 클라이언트 초기화
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = GoogleGenerativeAIEmbeddings(
    model=EMBEDDING_MODEL,
    task_type="RETRIEVAL_DOCUMENT"
)

# 텍스트 분할기 설정
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    length_function=len
)

# 한국어 책 이름 매핑 (bnumber -> 한국어 이름)
KOREAN_BOOK_NAMES = {
    1: "창세기", 2: "출애굽기", 3: "레위기", 4: "민수기", 5: "신명기",
    6: "여호수아", 7: "사사기", 8: "룻기", 9: "사무엘상", 10: "사무엘하",
    11: "열왕기상", 12: "열왕기하", 13: "역대상", 14: "역대하", 15: "에스라",
    16: "느헤미야", 17: "에스더", 18: "욥기", 19: "시편", 20: "잠언",
    21: "전도서", 22: "아가", 23: "이사야", 24: "예레미야", 25: "예레미야애가",
    26: "에스겔", 27: "다니엘", 28: "호세아", 29: "요엘", 30: "아모스",
    31: "오바댜", 32: "요나", 33: "미가", 34: "나훔", 35: "하박국",
    36: "스바냐", 37: "학개", 38: "스가랴", 39: "말라기",
    40: "마태복음", 41: "마가복음", 42: "누가복음", 43: "요한복음", 44: "사도행전",
    45: "로마서", 46: "고린도전서", 47: "고린도후서", 48: "갈라디아서", 49: "에베소서",
    50: "빌립보서", 51: "골로새서", 52: "데살로니가전서", 53: "데살로니가후서", 54: "디모데전서",
    55: "디모데후서", 56: "디도서", 57: "빌레몬서", 58: "히브리서", 59: "야고보서",
    60: "베드로전서", 61: "베드로후서", 62: "요한일서", 63: "요한이서", 64: "요한삼서",
    65: "유다서", 66: "요한계시록"
}


def parse_xml_bible(xml_path: Path) -> List[Dict]:
    """XML 성경 파일 파싱"""
    documents = []
    
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        # 네임스페이스 제거 (있는 경우)
        if '}' in root.tag:
            ns = {'': root.tag.split('}')[0].split('{')[1]}
        else:
            ns = {'': ''}
        
        # BIBLEBOOK 요소들 찾기
        for book in root.findall('.//BIBLEBOOK'):
            book_number = int(book.get('bnumber', 0))
            book_name = KOREAN_BOOK_NAMES.get(book_number, book.get('bname', 'Unknown'))
            
            # CHAPTER 요소들 찾기
            for chapter in book.findall('CHAPTER'):
                chapter_number = chapter.get('cnumber', '')
                
                # VERS 요소들 찾기
                verses = []
                for verse in chapter.findall('VERS'):
                    verse_number = verse.get('vnumber', '')
                    verse_text = verse.text.strip() if verse.text else ''
                    
                    if verse_text:
                        verses.append({
                            "verse": verse_number,
                            "text": verse_text
                        })
                
                # 절들을 하나의 문서로 결합
                if verses:
                    verse_texts = [f"{v['verse']}:{v['text']}" for v in verses]
                    content = " ".join(verse_texts)
                    
                    documents.append({
                        "book": book_name,
                        "chapter": chapter_number,
                        "verse": "",  # 전체 장이므로 절 번호는 비움
                        "content": content
                    })
        
        print(f"파싱 완료: {len(documents)}개의 장 문서를 생성했습니다.")
        
    except Exception as e:
        print(f"XML 파싱 오류 ({xml_path}): {e}")
        import traceback
        traceback.print_exc()
    
    return documents


def get_embedding(text: str) -> List[float]:
    """텍스트를 임베딩으로 변환"""
    try:
        embedding = embeddings.embed_query(
            text,
            output_dimensionality=EMBEDDING_DIMENSION  # 환경변수에서 차원 가져오기
        )
        # 임베딩 차원 확인 (처음 한 번만 출력)
        if not hasattr(get_embedding, 'dimension_logged'):
            print(f"임베딩 차원 확인: {len(embedding)}차원 (output_dimensionality={EMBEDDING_DIMENSION})")
            get_embedding.dimension_logged = True
        return embedding
    except Exception as e:
        print(f"임베딩 생성 오류: {e}")
        return []


def chunk_documents(documents: List[Dict]) -> List[Dict]:
    """문서를 더 작은 청크로 분할"""
    chunked_docs = []
    
    for doc in documents:
        # 텍스트 분할
        chunks = text_splitter.split_text(doc["content"])
        
        for chunk in chunks:
            chunked_docs.append({
                "book": doc["book"],
                "chapter": doc["chapter"],
                "verse": doc["verse"],
                "content": chunk
            })
    
    return chunked_docs


def upload_to_supabase(documents: List[Dict], batch_size: int = 100):
    """Supabase에 문서 업로드"""
    total = len(documents)
    uploaded = 0
    
    print(f"\n총 {total}개의 문서를 업로드합니다...")
    
    for i in range(0, total, batch_size):
        batch = documents[i:i + batch_size]
        batch_data = []
        
        for doc in batch:
            # 임베딩 생성
            embedding = get_embedding(doc["content"])
            
            if embedding:
                batch_data.append({
                    "book": doc["book"],
                    "chapter": doc["chapter"],
                    "verse": doc["verse"],
                    "content": doc["content"],
                    "embedding": embedding
                })
        
        # Supabase에 배치 삽입
        if batch_data:
            try:
                supabase.table(SUPABASE_TABLE_NAME).insert(batch_data).execute()
                uploaded += len(batch_data)
                print(f"진행률: {uploaded}/{total} ({uploaded*100//total if total > 0 else 0}%)")
            except Exception as e:
                print(f"업로드 오류: {e}")
                import traceback
                traceback.print_exc()
    
    print(f"\n업로드 완료: {uploaded}개")


def main():
    """메인 함수"""
    print("=" * 60)
    print("성경 XML 파일을 Supabase 벡터 DB에 적재합니다")
    print("출처: 대한성서공회, 1961 개정 '성경전서 개역한글판'")
    print("=" * 60)
    
    # XML 파일 찾기
    xml_file = Path("bible/SF_2022-09-19_KOR_KORRV_(Korean Revised Version 1952 1961).xml")
    
    if not xml_file.exists():
        print(f"오류: XML 파일을 찾을 수 없습니다: {xml_file}")
        return
    
    print(f"\nXML 파일 처리 중: {xml_file.name}")
    
    # XML 파싱
    all_documents = parse_xml_bible(xml_file)
    
    if not all_documents:
        print("오류: 파싱된 문서가 없습니다.")
        return
    
    print(f"\n총 {len(all_documents)}개의 문서를 읽었습니다.")
    
    # 청킹
    print("\n문서를 청크로 분할 중...")
    chunked_docs = chunk_documents(all_documents)
    print(f"총 {len(chunked_docs)}개의 청크로 분할되었습니다.")
    
    # Supabase에 업로드
    print("\nSupabase에 업로드 중...")
    upload_to_supabase(chunked_docs)
    
    print("\n" + "=" * 60)
    print("완료!")
    print("=" * 60)


if __name__ == "__main__":
    main()
