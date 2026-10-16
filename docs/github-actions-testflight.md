# Windows에서 GitHub Actions로 TestFlight 갱신하기

SetGo의 `iOS TestFlight Release`는 GitHub가 제공하는 Mac 실행 환경에서 서명된 iPhone 앱을 만들고 App Store Connect로 업로드한다. 별도 Mac 임대, Mac 구매, 원격 데스크톱 접속은 필요 없다.

TestFlight에서 `Expired`가 된 빌드는 연장할 수 없다. 같은 앱의 새 빌드를 올린 뒤 기존 테스터 그룹에 연결한다. 테스터를 새로 만들 필요는 없다. 기존 iPhone 앱을 삭제하지 않고 업데이트해야 기기에 저장된 기록을 유지할 수 있다.

## 1. 처음 한 번 준비할 것

- 유효한 Apple Developer Program 멤버십.
- 기존 App Store Connect 앱 `SetGo`와 Bundle ID `app.setgo.mobile`.
- 개인 키가 포함된 **Apple Distribution `.p12`** 파일과 비밀번호.
- 위 인증서를 선택해 만든 **App Store Connect 배포용 `.mobileprovision`** 파일.
- **App Store Connect 팀 API 키 `.p8`**, Key ID, Issuer ID. APNs 키와 개인 API 키는 이 절차의 대상이 아니다.
- GitHub 저장소 `jeongjae/SetGo`에 Actions 비밀값을 등록할 권한.

이미 `.p12`와 비밀번호가 있으면 2~3단계는 생략한다. `.cer` 파일만 있으면 개인 키가 없으므로 `.p12` 대신 쓸 수 없다. 이전 Mac에만 개인 키가 있었다면 Windows에서 새 인증서 요청을 만든다. 기존 인증서를 임의로 취소하지 않는다.

모든 명령의 시작 위치:

```powershell
cd C:\Users\NB-24021500\Projects\SetGo\setgo-starter
```

## 2. Windows에서 인증서 요청 만들기

Git for Windows에 포함된 OpenSSL을 자동으로 사용한다.

```powershell
.\scripts\ios-signing.ps1 -Action request
```

이메일 주소와 서명 비밀번호를 입력한다. 비밀번호는 화면에 표시되지 않는다. 다음 파일이 로컬의 `.ios-signing` 폴더에 만들어진다.

- `distribution.certSigningRequest`: Apple에 업로드할 인증서 요청.
- `distribution.key`: 암호화된 개인 키. 요청을 생성할 때 입력한 비밀번호와 함께 보관한다.

이 폴더는 Git에서 제외된다. 파일 내용이나 비밀번호를 채팅에 붙여넣지 않는다.

직접 비밀번호를 입력하지 않고 이 Windows 계정에서 준비하려면 아래 방식도 사용할 수 있다. 이메일 없는 CSR과 무작위 비밀번호를 생성하며, 비밀번호는 Windows 사용자 보호(DPAPI)로 암호화해 `.ios-signing/password.dpapi`에 저장한다. 평문 비밀번호를 출력하지 않는다.

```powershell
.\scripts\ios-signing.ps1 -Action request -GeneratePassword
```

이 방식을 선택했다면 이후 `package`, `register` 명령에도 **`-UseSavedPassword`**를 추가한다. 같은 Windows PC와 사용자 계정에서 실행해야 하며, `.ios-signing` 폴더를 유지한다. 다른 PC에서 사용하는 별도 `.p12`에는 이 옵션을 사용하지 않는다. 기존 키, 요청, 저장된 비밀번호는 덮어쓰지 않는다.

## 3. Apple Distribution 인증서와 .p12 만들기

Windows 브라우저에서 [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)를 연다.

1. `+` → **Apple Distribution**을 선택한다.
2. 2단계의 `distribution.certSigningRequest`를 업로드한다.
3. 생성된 `.cer`를 다운로드한다.
4. 다운로드한 파일의 실제 경로로 아래 명령을 실행한다.

```powershell
.\scripts\ios-signing.ps1 -Action package -CertificatePath "$env:USERPROFILE\Downloads\distribution.cer"
```

2단계에서 정한 비밀번호를 입력한다. `.ios-signing\distribution.p12`가 생성되며 같은 비밀번호로 보호된다. 인증서와 개인 키가 일치하지 않으면 생성을 중단한다.

Apple에서 인증서 수 제한이 표시되면 기존 인증서의 취소 여부를 별도로 판단한다. 이 도구는 인증서를 자동으로 생성하거나 취소하지 않는다.

## 4. 배포 프로파일 다운로드

[Apple Developer Profiles](https://developer.apple.com/account/resources/profiles/list)에서 다음과 같이 생성한다.

1. `+` → Distribution의 **App Store Connect**를 선택한다. 화면에 따라 `App Store`로 표시될 수 있다.
2. 기존 App ID **`app.setgo.mobile`**을 선택한다. 새 App ID를 만들지 않는다.
3. `.p12`와 일치하는 **Apple Distribution 인증서**를 선택한다.
4. 이름을 `SetGo GitHub Actions`로 지정하고 생성한다.
5. `.mobileprovision` 파일을 다운로드한다.

Development, Ad Hoc, Enterprise 프로파일은 TestFlight용으로 사용할 수 없다. 실제 iPhone의 UDID 등록은 필요하지 않다.

## 5. App Store Connect API 키 준비

[App Store Connect](https://appstoreconnect.apple.com/) → `Users and Access → Integrations → App Store Connect API → Team Keys`로 이동한다.

1. 필요하면 Account Holder가 API 접근을 먼저 요청한다.
2. 키를 생성한다. 이름은 `SetGo GitHub Actions`, Access는 **Developer**로 지정하면 현재 빌드 업로드에 충분하다. 테스터 배포 관리까지 API로 수행할 때는 해당 작업의 역할 요건에 맞춘다. 앱 업로드가 가능한 팀 키를 사용한다.
3. **Key ID**와 **Issuer ID**를 확인한다.
4. `.p8` 파일을 다운로드해 보관한다. 개인 키는 한 번만 다운로드할 수 있다.

App Store Connect API 키를 Apple Developer의 일반 `Keys` 메뉴에서 만드는 APNs 키와 혼동하지 않는다. `.p8`은 Base64로 바꾸지 않고 원문을 GitHub secret에 저장한다.

## 6. GitHub에 보안 설정 등록

GitHub CLI 로그인 상태를 확인하고, 필요한 경우 로그인한다.

```powershell
gh auth status
gh auth login
```

아래 경로와 ID를 실제 값으로 바꿔 실행한다. ID는 비밀번호가 아니다. `.p12` 비밀번호는 실행 중에 숨김 입력으로 받는다.

```powershell
.\scripts\ios-signing.ps1 -Action register `
  -ProfilePath "$env:USERPROFILE\Downloads\SetGo_GitHub_Actions.mobileprovision" `
  -ApiKeyPath "$env:USERPROFILE\Downloads\AuthKey_실제KEYID.p8" `
  -ApiKeyId '실제KEYID' `
  -IssuerId '실제ISSUER-ID'
```

기존 `.p12`를 사용할 때는 `-P12Path '실제경로\certificate.p12'`도 지정한다. 위 다운로드 파일 이름은 예시이며 실제 파일명을 사용한다. 스크립트는 아래 여섯 값을 GitHub stdin으로 직접 전달하며 값 자체를 출력하지 않는다.

| GitHub repository secret | 저장되는 값 |
| --- | --- |
| `IOS_DISTRIBUTION_P12_BASE64` | `.p12`의 Base64 |
| `IOS_DISTRIBUTION_P12_PASSWORD` | `.p12` 비밀번호 |
| `IOS_PROVISION_PROFILE_BASE64` | `.mobileprovision`의 Base64 |
| `APP_STORE_CONNECT_API_KEY_P8` | `.p8` 원문 |
| `APP_STORE_CONNECT_API_KEY_ID` | 팀 API Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | 팀 API Issuer ID |

GitHub 웹의 `Settings → Secrets and variables → Actions → Repository secrets`에서도 같은 이름으로 등록할 수 있다. Team ID는 프로파일에서 읽으므로 별도로 입력하지 않는다.

## 7. 새 빌드 업로드 실행

먼저 App Store Connect → SetGo → TestFlight에서 기존 앱 버전과 마지막 빌드 번호를 확인한다. 예를 들어 **`1.0 (1)`이면 `version=1.0`, `build_number=2`**로 실행한다. 기존 버전이 `1.0.0`이면 그 값을 그대로 사용한다.

[GitHub Actions](https://github.com/jeongjae/SetGo/actions/workflows/ios-testflight.yml) → **iOS TestFlight Release → Run workflow**에서 배포할 브랜치, 버전, 새 빌드 번호를 선택한다. 일반적으로 `main`을 사용한다.

CLI로도 실행할 수 있다.

```powershell
gh workflow run ios-testflight.yml --repo jeongjae/SetGo --ref main -f version=1.0 -f build_number=2
gh run list --repo jeongjae/SetGo --workflow ios-testflight.yml --limit 3
```

`version` 기본값은 저장소 기준 `1.0`이며 App Store Connect에서 읽은 값이 아니다. 실제 값에 맞춘다. 빌드 번호는 이전 업로드보다 커야 한다. 이미 업로드된 실행을 다시 시도할 때도 새 번호로 **새 실행**을 만든다. 이 작업은 번호를 임의로 바꾸지 않는다.

Workflow는 입력과 보안 설정을 먼저 확인하고 테스트를 실행한다. 이후 Mac에서 웹 빌드와 Capacitor sync, 프로파일/인증서 검증, Release Archive, App Store Connect 업로드를 진행한다. 서명 정보는 임시 키체인에서 사용하고 마지막에 삭제한다. 수동 실행만 지원하며, 코드 push만으로 TestFlight에 업로드하지 않는다.

Mac 작업은 `macos-15` 이미지에 설치된 **Xcode 26.3**을 `DEVELOPER_DIR`로 명시해 사용한다. 이미지의 기본 Xcode 16.4를 그대로 사용하지 않는다. 설치 버전이나 Apple SDK 제출 기준이 바뀌면 이 경로를 함께 갱신한다.

현재 앱은 SQLite 암호화를 사용하지 않으며 별도 암호화 기능을 구현하지 않는다. `ios/App/App/Info.plist`에 `ITSAppUsesNonExemptEncryption=false`를 포함해 기존 빌드와 같은 수출 규정 면제 정보를 제출한다. 따라서 Developer 권한 키로 업로드한 뒤 별도 API 수정 권한 없이 TestFlight 처리를 진행할 수 있다. 앱에 암호화 기능을 추가하면 이 선언도 실제 기능에 맞춰 검토해야 한다.

기존 **iOS Native Check**는 시뮬레이터 검증 작업으로 계속 사용한다. 그 작업의 성공은 TestFlight 업로드 성공을 뜻하지 않는다.

## 8. iPhone에서 다시 사용

1. App Store Connect → SetGo → TestFlight에서 새 빌드의 Apple 처리가 끝날 때까지 기다린다.
2. `Missing Compliance`가 있다면 앱의 실제 암호화 사용 방식에 맞게 질문에 답한다.
3. 기존 Internal Testing 그룹에 새 빌드를 추가한다. 외부 테스터 배포에는 필요한 Beta App Review를 거친다.
4. 기존 Apple ID로 iPhone의 TestFlight를 열고 SetGo를 업데이트한다.
5. 운동 기록을 확인하고 JSON 백업을 내보낸다.

Workflow의 업로드 성공과 Apple의 처리 완료는 별개다. 업로드 후 보이지 않으면 App Store Connect의 처리 상태 및 Apple 이메일을 확인한다. 새 TestFlight 빌드도 업로드 후 최대 90일 동안만 사용할 수 있다.

## 실패했을 때

- **Missing repository secret**: 6단계의 여섯 설정 이름을 확인한다. Mac 실행 전 중단된다.
- **Profile has expired**: 새 App Store Connect 프로파일을 만들고 다시 등록한다.
- **Profile does not match a valid Apple Distribution certificate**: 프로파일에 선택한 인증서와 `.p12`의 인증서/개인 키가 일치해야 한다. 만료·취소된 인증서도 확인한다.
- **Duplicate / redundant binary / build number**: 이전보다 큰 빌드 번호로 새 workflow 실행을 만든다.
- **Authentication / permission**: Team API Key ID, Issuer ID, `.p8`의 조합과 업로드 권한, 멤버십, 미동의 약관을 확인한다.
- **Xcode / SDK requirement**: 실행 로그의 Xcode 버전을 확인하고 Apple 요구사항에 맞는 GitHub Mac 이미지를 선택한다.

GitHub 실행 로그는 `ios-testflight-logs-...` artifact로 7일 보관한다. 인증서, 개인 키, 프로파일, `.xcarchive`는 artifact로 게시하지 않는다. 호스팅 실행 환경의 과금 여부는 GitHub 플랜과 Actions 사용량에 따른다.

## 공식 자료

- [GitHub: Xcode 앱 서명용 인증서와 프로파일 설정](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
- [Apple: App Store Connect 프로파일 생성](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/)
- [Apple: App Store Connect API](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)
- [Apple: TestFlight 개요](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
