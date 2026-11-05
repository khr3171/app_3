# Vercel 규정 개선 건의 배포 안내

## 배포
이 ZIP을 풀어서 내용 전체를 저장소 루트에 덮어씁니다. public만 올리면 건의 접수 서버가 빠집니다.
Framework: Other / Root Directory: 저장소 루트 / Output Directory: public / Node.js 22 이상.
건의 접수는 GitHub Pages에서 동작하지 않습니다. Vercel 주소를 사용합니다.

## 필수 서버 환경변수
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 Vercel Production에 설정한 뒤 재배포합니다.
이미 다른 Vercel 프로젝트에 설정한 값은 새 프로젝트로 자동 복사되지 않습니다. 비공개 키 파일은 GitHub나 public 폴더에 업로드하지 않습니다.
Firestore 클라이언트 규칙은 모든 read/write false를 유지합니다. 관리자 SDK 서버만 suggestions에 접수합니다. 공개 목록·조회 API는 제공하지 않습니다.

## 관리자 검토
Firebase 콘솔 → Firestore → suggestions 컬렉션에서 원문을 열람합니다.
receipt: 접수번호 / status: received(접수), reviewing(검토), committee(안건 검토), closed(종결)
committeeCandidate: 운영위원회 안건 후보이면 true로 변경합니다. 관리자 검토 후 별도로 안건에 올리는 방식이며 자동 상정 기능은 아닙니다.
콘솔 접근 권한은 관리자 계정만 유지합니다. 직원 승인 목록은 필요하지 않습니다.

## 개인정보 보유기간
화면에서 1년 수집·이용 동의를 받습니다. 각 문서에 expiresAt을 저장합니다.
운영 전 Google Cloud Firestore TTL 설정에서 suggestions 컬렉션 그룹의 expiresAt을 활성화하거나, 관리자가 월별 점검해 1년이 지난 자료를 삭제해야 합니다. TTL 정책은 이 파일 배포만으로 자동 활성화되지 않습니다. 일일 제한용 suggestionLimits 기록도 주기적으로 정리합니다.
이름·소속은 본인 입력값이며 신원 검증 기능은 없습니다. 로그인 없이 익명 계정 제출이 가능하다는 의미이며 개인정보를 수집하지 않는 완전 익명은 아닙니다.

## 확인
실제 입력 동의 후 테스트 건의 1건을 제출하고 접수번호 표시 및 Firebase 저장을 확인하세요. 테스트 자료는 관리자 콘솔에서 정리합니다.
소속·이름·조항·문제점·개선방향의 필수입력/길이 검사, 개인정보 동의, 공개 조회 차단, 검색 연동 검사는 로컬에서 확인했습니다. 클라우드 실제 접수는 배포 후 확인이 필요합니다.
