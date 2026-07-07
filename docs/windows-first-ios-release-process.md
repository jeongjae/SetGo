# SetGo Windows-First iOS Release Process

## 목적

SetGo는 Windows PC에서 대부분의 개발, 테스트, PWA 배포, iOS 호환성 검증을 끝내고, 클라우드 Mac은 마지막 iOS 서명, Xcode 실행 확인, Archive, TestFlight 업로드에만 짧게 사용한다.

운영 모델은 다음과 같다.

```text
Windows PC:
  제품 개발
  PWA 테스트와 배포
  Capacitor iOS sync 확인

GitHub Actions:
  GitHub Pages 배포 확인
  unsigned iOS simulator build 확인

Scaleway Cloud Mac:
  Apple Developer 로그인
  Xcode signing
  Native Storage Check
  Archive
  App Store Connect/TestFlight 업로드
```

Mac은 상시 개발 머신이 아니라 릴리스 머신으로만 쓴다.

## 현재 SetGo iOS 값

```text
App name: SetGo
Bundle ID: app.setgo.mobile
SKU: setgo-ios
Platform: iOS
Capacitor app id: app.setgo.mobile
iOS project: ios/App/App.xcodeproj
Native SQLite location: Library/SetGoDatabase
```

Bundle ID는 앱의 고유 식별자다. Apple Developer, App Store Connect, Xcode, `capacitor.config.ts`의 값이 모두 `app.setgo.mobile`로 일치해야 한다.

참고:

- Apple Developer App ID 등록: https://developer.apple.com/help/account/identifiers/register-an-app-id/
- App Store Connect 앱 생성: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- App privacy URL 요구사항: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Scaleway Apple Silicon 가격: https://www.scaleway.com/en/pricing/apple-silicon/
- Scaleway Apple Silicon quickstart: https://www.scaleway.com/en/docs/apple-silicon/quickstart/

## Cloud Mac 선택

### 1순위: Scaleway Mac mini M2

SetGo 첫 TestFlight 업로드에는 Scaleway Mac mini M2를 기본 선택으로 둔다.

이유:

- 시간 단가와 월 단가가 공개되어 있다.
- Apple silicon 전용 Mac mini를 빌릴 수 있다.
- SSH와 VNC 기반으로 Windows에서 접근 가능하다.
- 24시간만 쓰고 삭제하는 릴리스 머신 운영에 적합하다.
- M1보다 Xcode 빌드, npm install, Simulator 실행에 여유가 있다.

Scaleway 가격표 기준:

```text
Mac mini M1: EUR 75/month, EUR 0.11/hour
Mac mini M2: EUR 115/month, EUR 0.17/hour
```

주의:

- Apple 라이선스 제약 때문에 최소 24시간 임대가 있다.
- 서버 생성 전에 SSH key를 Scaleway 계정에 등록해야 한다.
- 사용 후 삭제하지 않으면 계속 과금된다.

### 최저 비용 실험: Scaleway Mac mini M1

M1은 더 싸다. 단, Xcode 버전, macOS 버전, 빌드 속도, 8GB RAM 제한 때문에 첫 릴리스에서 시간이 더 들 수 있다. Xcode가 잘 돌아가고 가용성이 좋으면 M1도 가능하다.

### 보조 선택: MacinCloud Dedicated

MacinCloud는 원격 데스크톱 편의성이 장점이다. 하지만 SetGo처럼 Node, Git, Xcode, Capacitor, signing을 직접 다루려면 Managed 또는 Pay-as-you-go보다 Dedicated가 낫다.

MacinCloud Managed/Pay-as-you-go는 admin/root 권한이 없을 수 있으므로 첫 SetGo 업로드의 기본 선택으로 두지 않는다.

## One-Time Apple Setup

이 섹션은 Apple 웹사이트에서 한 번만 해두는 작업이다. Windows 브라우저에서 진행하면 된다. Cloud Mac을 빌리기 전에 끝내는 것이 좋다.

### 1. Apple Developer Team 확인

1. https://developer.apple.com/account/ 에 접속한다.
2. Apple Developer Program 등록이 완료된 Apple ID로 로그인한다.
3. 계정 화면에서 Team이 유료 개발자 Team인지 확인한다.
4. 개인 계정이면 본인 이름의 Team, 법인 계정이면 회사 Team을 선택한다.

주의:

- 무료 개인 Team에 Bundle ID를 만들면 나중에 유료 Team에서 같은 Bundle ID를 못 쓸 수 있다.
- 항상 유료 Apple Developer Team이 선택된 상태에서 진행한다.

### 2. App ID, Bundle ID 등록

1. Apple Developer Account에서 `Certificates, Identifiers & Profiles`로 이동한다.
2. 왼쪽 메뉴에서 `Identifiers`를 클릭한다.
3. 상단 `+` 버튼을 클릭한다.
4. `App IDs`를 선택하고 Continue.
5. `App`을 선택하고 Continue.
6. Description 입력:

```text
SetGo
```

7. Bundle ID 타입은 `Explicit`을 선택한다.
8. Bundle ID 입력:

```text
app.setgo.mobile
```

9. Capabilities는 현재 기본값으로 둔다.

현재 SetGo에 아직 켜지 않는 항목:

```text
Push Notifications
Sign in with Apple
HealthKit
iCloud
Associated Domains
App Groups
```

10. Continue.
11. 아래 값이 맞는지 확인한다.

```text
Description: SetGo
Bundle ID: app.setgo.mobile
```

12. Register를 클릭한다.

완료 기준:

```text
Identifiers 목록에 SetGo / app.setgo.mobile 이 보인다.
```

### 3. App Store Connect 앱 레코드 생성

1. https://appstoreconnect.apple.com/ 에 접속한다.
2. `Apps`로 이동한다.
3. `+` 버튼을 클릭한다.
4. `New App`을 선택한다.
5. 아래처럼 입력한다.

```text
Platforms: iOS
Name: SetGo
Primary Language: Korean
Bundle ID: app.setgo.mobile
SKU: setgo-ios
User Access: Full Access
```

6. Create를 클릭한다.

완료 기준:

```text
App Store Connect > Apps 목록에 SetGo가 보인다.
SetGo > App Information에서 Bundle ID가 app.setgo.mobile 이다.
```

### 4. App Information 기본값 확인

App Store Connect의 SetGo 앱에서 `App Information`을 연다.

권장값:

```text
Name: SetGo
Bundle ID: app.setgo.mobile
SKU: setgo-ios
Primary Language: Korean
Primary Category: Health & Fitness
Secondary Category: blank
```

주의:

- Bundle ID는 첫 빌드 업로드 후 사실상 바꾸기 어렵다.
- `app.setgo.mobile`로 계속 갈지 확정한 뒤 첫 빌드를 올린다.

### 5. Privacy Policy URL 준비

Apple은 모든 앱에 Privacy Policy URL을 요구한다. SetGo는 로컬 우선 앱이므로 정책은 간단하게 만들 수 있다.

권장 URL:

```text
https://jeongjae.github.io/SetGo/privacy.html
```

Privacy Policy에 반드시 들어갈 내용:

```text
SetGo는 계정 생성을 요구하지 않는다.
SetGo는 운동 기록을 사용자의 기기 로컬 저장소에 저장한다.
SetGo는 자체 서버로 운동 기록을 전송하지 않는다.
사용자가 JSON, CSV, Markdown으로 직접 내보낸 데이터는 사용자가 관리한다.
사용자가 AI Coach endpoint를 직접 설정하고 요청한 경우, 코칭 생성을 위해 일부 운동 요약과 통계 컨텍스트가 해당 endpoint로 전송될 수 있다.
```

첫 내부 TestFlight만 진행할 때도 URL을 미리 준비하는 것이 좋다.

### 6. App Privacy 답변 준비

App Store Connect의 `App Privacy`에서 답변할 내용을 준비한다.

현재 SetGo 기준 기본 방향:

```text
Tracking: No
Data collected by SetGo server: No
Account creation: No
Third-party advertising: No
```

단, AI Coach endpoint는 사용자가 직접 설정하는 외부 endpoint다. 외부 TestFlight나 App Store 제출 전에는 Privacy Policy에 이 내용을 명확히 적고, App Privacy 답변도 실제 동작에 맞게 다시 확인한다.

## Windows Release Candidate Checklist

모든 개발은 먼저 Windows에서 끝낸다.

작업 경로:

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
```

### 1. 최신 상태 확인

```powershell
git status --short --branch
git pull --ff-only
```

작업트리에 관계없는 파일이 있으면 릴리스 커밋에 포함하지 않는다.

현재 자주 보일 수 있는 로컬 잔여 파일:

```text
docs/### SetGo 운동코치.md
src/pages/ExportPage.tsx line-ending only dirty state
```

내용 없는 줄끝 변경은 커밋하지 않는다.

### 2. Windows 전체 검증

```powershell
npm.cmd run test -- --run
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run test:viewport
npm.cmd run native:sync
```

### 3. Windows native:sync 후 Package.swift 확인

Windows에서 `npm.cmd run native:sync`를 실행하면 `ios/App/CapApp-SPM/Package.swift`의 local package path가 백슬래시로 바뀔 수 있다.

확인:

```powershell
git diff -- ios\App\CapApp-SPM\Package.swift
```

Mac-safe 값:

```swift
.package(name: "CapacitorCommunitySqlite", path: "../../../node_modules/@capacitor-community/sqlite"),
.package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences")
```

백슬래시로 바뀌었다면 위 값으로 되돌린다.

### 4. 커밋과 푸시

```powershell
git add <intended files>
git commit -m "<release change>"
git push origin main
```

### 5. GitHub Actions 확인

GitHub에서 아래 두 workflow가 성공해야 한다.

```text
Deploy SetGo
iOS Native Check
```

둘 다 성공하기 전에는 Scaleway Mac을 빌리지 않는다.

## Scaleway Release Session

이 섹션은 실제 Scaleway Mac을 빌려서 TestFlight에 올리는 날 따라 한다.

### 1. Scaleway 계정 준비

1. https://console.scaleway.com/ 에 가입 또는 로그인한다.
2. Organization과 Project를 만든다.
3. 결제 수단을 등록한다.
4. IAM 권한이 Owner 또는 Apple silicon 생성 가능 권한인지 확인한다.

### 2. Windows에서 SSH key 만들기

PowerShell에서 확인:

```powershell
Test-Path $env:USERPROFILE\.ssh\id_ed25519.pub
```

없으면 생성:

```powershell
ssh-keygen -t ed25519 -C "setgo-scaleway"
```

기본 경로를 그대로 사용한다.

공개키 확인:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

출력되는 한 줄을 복사한다.

### 3. Scaleway에 SSH key 등록

1. Scaleway Console에서 계정 또는 Project의 SSH Keys 메뉴로 이동한다.
2. Add SSH key 클릭.
3. Name:

```text
setgo-windows
```

4. Public key에 `id_ed25519.pub` 내용을 붙여넣는다.
5. Save.

### 4. Mac mini 생성

1. Scaleway Console 왼쪽 메뉴에서 `Apple silicon`으로 이동한다.
2. `Create Mac mini` 클릭.
3. Setup type:

```text
Standard
```

4. Availability Zone:

```text
PAR-1
```

5. Machine:

```text
Mac mini M2
```

가능하면 M2를 선택한다. 비용 최저가 우선이면 M1을 선택할 수 있다.

6. OS:

```text
macOS Tahoe 26
```

Scaleway에서 Tahoe 26을 선택할 수 있으면 Tahoe를 기본값으로 쓴다. App Store Connect 제출은 최신 stable Xcode와 최신 iOS SDK 요구사항을 따라가야 하므로, OS도 Xcode 요구사항에 맞춘다.

Fallback:

```text
macOS Sequoia 15.6+
```

Tahoe 이미지가 준비되지 않았거나 불안정할 때만 Sequoia를 선택한다.

7. Name:

```text
setgo-release-mac
```

8. Commitment:

```text
No commitment
```

9. 24시간 최소 과금 안내를 확인한다.
10. Create Mac mini.

주의:

- 생성에 시간이 걸릴 수 있다.
- 다른 macOS 버전을 선택하면 준비가 더 오래 걸릴 수 있다.

### 5. Scaleway Mac 접속

Scaleway가 제공하는 IP 주소를 확인한다.

SSH 접속:

```powershell
ssh <mac-user>@<scaleway-mac-ip>
```

사용자명은 Scaleway 콘솔에 표시되는 값을 쓴다. 예:

```powershell
ssh m1@1.2.3.4
```

VNC 또는 Remote Desktop:

1. Scaleway 콘솔의 remote desktop 안내를 따른다.
2. Windows에서는 RealVNC Viewer, TightVNC, 또는 Scaleway가 안내하는 클라이언트를 사용한다.
3. Xcode GUI 작업은 VNC/Remote Desktop에서 진행한다.

### 6. Mac 초기 설정

원격 Mac에 접속한 뒤 다음을 확인한다.

```bash
sw_vers
xcodebuild -version
git --version
```

Xcode가 없다면:

1. App Store에서 Xcode 설치, 또는 Apple Developer Downloads에서 설치.
2. Xcode 첫 실행.
3. 추가 컴포넌트 설치 허용.
4. License 동의:

```bash
sudo xcodebuild -license accept
```

Command Line Tools 확인:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
```

### 7. Node.js 설치

권장: Node.js LTS installer 사용.

브라우저에서:

```text
https://nodejs.org/
```

LTS macOS installer를 받아 설치한다.

설치 확인:

```bash
node -v
npm -v
```

### 8. Xcode Apple ID 로그인

1. Xcode 실행.
2. Xcode > Settings > Accounts.
3. `+` 버튼 클릭.
4. Apple ID 로그인.
5. SetGo의 Apple Developer Team이 보이는지 확인한다.

### 9. SetGo clone

터미널에서:

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/jeongjae/SetGo.git
cd SetGo/setgo-starter
```

최신 커밋 확인:

```bash
git status --short --branch
git log --oneline --decorate -3
```

### 10. 의존성 설치와 iOS sync

```bash
npm install
npm run native:sync
```

Mac에서는 `Package.swift` 경로가 `/`로 유지되어야 한다.

확인:

```bash
git diff -- ios/App/CapApp-SPM/Package.swift
```

내용 변경이 없어야 한다. 변경이 있다면 커밋하지 않는다.

### 11. Xcode 열기

```bash
npm run native:open
```

또는 Finder에서:

```text
ios/App/App.xcodeproj
```

를 연다.

### 12. Xcode Signing 설정

Xcode에서:

1. 왼쪽 Project Navigator에서 `App` project 클릭.
2. Targets에서 `App` 선택.
3. `Signing & Capabilities` 탭.
4. `Automatically manage signing` 체크.
5. Team 선택:

```text
Apple Developer Team
```

6. Bundle Identifier 확인:

```text
app.setgo.mobile
```

7. Signing error가 사라지는지 확인한다.

만약 Bundle ID 관련 오류가 나면:

- Apple Developer에 `app.setgo.mobile`이 등록되어 있는지 확인한다.
- Xcode Team이 올바른 유료 Team인지 확인한다.
- App Store Connect 앱 레코드의 Bundle ID와 일치하는지 확인한다.

### 13. Simulator smoke test

1. Xcode 상단 device selector에서 iPhone simulator 선택.
2. Run 버튼 클릭.
3. 앱이 빌드되고 simulator에서 실행되는지 확인.

최소 확인:

```text
Today 화면이 보인다.
More 화면으로 이동한다.
```

### 14. Native Storage Check

앱에서:

1. More 탭으로 이동.
2. `Native Storage Check` 실행.
3. 첫 실행 결과:

```text
First native record saved
```

4. 앱 종료.
5. 다시 실행.
6. More > `Native Storage Check` 재실행.
7. 두 번째 결과:

```text
Previous run found
```

이 단계가 v5 native storage 신뢰성의 첫 실기 증명이다.

### 15. Version과 Build 번호 확인

Xcode target `App` > General에서 확인:

```text
Version: 1.0
Build: 1
```

처음 업로드는 `1.0 (1)`로 가능하다.

다시 업로드할 때는 Build 번호를 반드시 올린다.

예:

```text
1.0 (2)
1.0 (3)
```

### 16. Archive

1. Xcode 상단 destination을 `Any iOS Device` 또는 generic iOS destination으로 변경한다.
2. 메뉴에서 Product > Archive 클릭.
3. Archive가 끝나면 Organizer가 열린다.

Archive 실패 시 우선 확인:

- Team signing 오류
- Bundle ID 불일치
- Package.swift path 문제
- Xcode가 추가 컴포넌트를 아직 설치하지 않은 상태
- `npm run native:sync`를 Mac에서 실행하지 않은 상태

`Your team has no devices` 또는 `No profiles for app.setgo.mobile were found`가 나오면 Xcode가 개발용 provisioning profile을 찾는 상태다. 클라우드 Mac에는 실제 iPhone이 연결되어 있지 않으므로 개발용 profile 생성은 실패할 수 있다.

TestFlight/App Store 업로드용 Archive가 목표라면 다음을 확인한다.

1. Xcode > Settings > Accounts > Manage Certificates에서 `Apple Distribution` 인증서가 있는지 확인한다.
2. Apple Developer > Certificates, Identifiers & Profiles > Identifiers에 `app.setgo.mobile` App ID가 있는지 확인한다.
3. 자동 signing이 계속 실패하면 Apple Developer > Profiles에서 `Distribution > App Store` profile을 만든다.
4. Profile 이름:

```text
SetGo App Store
```

5. 다운로드한 `.mobileprovision` 파일을 Mac에서 더블클릭해 설치한다.
6. Xcode > TARGETS > App > Signing & Capabilities에서 `Release`를 선택한다.
7. Release signing을 다음처럼 맞춘다.

```text
Automatically manage signing: off
Team: Jeongjae Kim
Bundle Identifier: app.setgo.mobile
Provisioning Profile: SetGo App Store
Signing Certificate: Apple Distribution
```

Debug는 simulator 실행용으로 automatic signing을 유지해도 된다.

### 17. Distribute App

Organizer에서:

1. 방금 만든 Archive 선택.
2. `Distribute App` 클릭.
3. `App Store Connect` 선택.
4. `Upload` 선택.
5. Signing은 automatic 유지.
6. Validate 또는 Upload 진행.
7. 문제가 없으면 Upload 완료.

### 18. App Store Connect 처리 확인

1. https://appstoreconnect.apple.com/ 접속.
2. Apps > SetGo.
3. TestFlight 탭.
4. Builds 목록에서 업로드한 build가 Processing 상태인지 확인.
5. Processing 완료까지 기다린다.

첫 빌드는 처리에 시간이 걸릴 수 있다.

Build에 `Missing Compliance`가 표시되면 build 옆 `Manage`를 눌러 Export Compliance 질문에 답한다. SetGo가 자체 암호화 기능을 제공하지 않고 표준 HTTPS/Apple 시스템 보안만 쓰는 상태라면 암호화 사용 여부 질문은 일반적으로 `No` 또는 standard encryption exemption에 맞춰 답한다. 화면 문구가 바뀌면 실제 문구 기준으로 다시 확인한다.

### 19. Internal TestFlight 추가

Processing이 끝나면:

1. TestFlight > Internal Testing으로 이동.
2. 내부 테스터 그룹 생성 또는 기존 그룹 선택.
3. Build를 추가한다.
4. 본인 Apple ID를 internal tester로 추가한다.
5. TestFlight 앱에서 설치한다.

내부 테스터 화면에서 `No Builds Available`이 보이면 그룹에 build가 아직 연결되지 않은 상태다. Internal Testing 그룹의 `Builds` 탭에서 `1.0.0 (1)` 같은 처리 완료 build를 추가한다.

다른 내부 테스터를 추가하려면 먼저 App Store Connect > Users and Access에 해당 Apple ID를 초대하고, 초대 수락 후 Internal Testing 그룹에 추가한다. 이메일만으로 넓게 배포하려면 External Testing을 쓰지만, 첫 외부 테스트는 Beta App Review가 필요하다.

첫 내부 테스트 체크:

```text
앱 설치
Today 화면 렌더
More 화면 렌더
Native Storage Check
앱 종료 후 재실행
Native Storage Check previous run found
운동 시작과 세트 입력
백업 내보내기
```

### 20. Scaleway Mac 정리

업로드와 TestFlight 확인이 끝나면 바로 정리한다.

1. Xcode에서 Apple ID sign out.
2. 브라우저에서 App Store Connect sign out.
3. SetGo repo에 인증 파일이나 개인 백업 파일이 남아 있지 않은지 확인.
4. Scaleway Console에서 Mac mini 삭제.
5. Billing에서 삭제 상태 확인.

주의:

- 삭제하지 않으면 계속 과금된다.
- Apple ID가 남아 있는 임시 Mac을 방치하지 않는다.

## Security Rules

- Apple ID 비밀번호를 repo, 문서, `.env`에 저장하지 않는다.
- 인증서, provisioning profile, App Store Connect API key, `.p8` 파일을 커밋하지 않는다.
- rented Mac에 개인 운동 백업을 올리지 않는다. 꼭 필요하면 테스트 후 삭제한다.
- Mac 사용 후 Xcode 계정에서 로그아웃하거나 서버를 삭제한다.
- Cloud Mac에서 만든 local 변경은 필요할 때만 PR/commit으로 가져온다.

## Release Day Short Checklist

```text
Windows:
[ ] git pull --ff-only
[ ] npm.cmd run test -- --run
[ ] npm.cmd run build
[ ] npm.cmd run test:e2e
[ ] npm.cmd run test:viewport
[ ] npm.cmd run native:sync
[ ] Package.swift path 확인
[ ] commit/push
[ ] Deploy SetGo green
[ ] iOS Native Check green

Scaleway:
[ ] Mac mini M2 생성
[ ] SSH/VNC 접속
[ ] Xcode/Node/Git 확인
[ ] git clone SetGo
[ ] npm install
[ ] npm run native:sync
[ ] Xcode Team 설정
[ ] simulator run
[ ] Native Storage Check 1차
[ ] relaunch
[ ] Native Storage Check 2차
[ ] Archive
[ ] Upload to App Store Connect
[ ] TestFlight processing 확인
[ ] Internal Testing에 build 추가
[ ] Scaleway Mac 삭제
```
