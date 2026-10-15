"""Validate the imported App Store identity and configure only the app's Release target.

Runs on the disposable GitHub macOS runner. Never reads personal workout data.
"""

import hashlib
import os
from pathlib import Path
import plistlib
import re
import shutil
from datetime import datetime, timezone
from uuid import UUID


BUNDLE_ID = 'app.setgo.mobile'


def validate_profile(profile, identities, now=None):
    now = now or datetime.now(timezone.utc)
    expiry = profile['ExpirationDate'].replace(tzinfo=timezone.utc)
    if expiry <= now:
        raise ValueError('Provisioning profile has expired. Create and register a new App Store profile.')
    entitlements = profile['Entitlements']
    prefixes = profile.get('ApplicationIdentifierPrefix', [])
    app_ids = {f'{prefix}.{BUNDLE_ID}' for prefix in prefixes}
    if entitlements.get('application-identifier') not in app_ids:
        raise ValueError(f'Provisioning profile must explicitly identify {BUNDLE_ID}.')
    if (entitlements.get('get-task-allow') or 'ProvisionedDevices' in profile
            or profile.get('ProvisionsAllDevices') or not entitlements.get('beta-reports-active')):
        raise ValueError('Use an App Store Connect distribution profile, not Development, Ad Hoc, or Enterprise.')
    team = profile['TeamIdentifier'][0]
    if not re.fullmatch(r'[A-Z0-9]{10}', team):
        raise ValueError('Invalid Apple Team ID in provisioning profile.')
    if entitlements.get('com.apple.developer.team-identifier') != team:
        raise ValueError('Provisioning profile team identifiers do not match.')
    profile_uuid = str(UUID(profile['UUID'])).upper()
    certificate = next((hashlib.sha1(der).hexdigest().upper()
                        for der in profile['DeveloperCertificates']
                        if hashlib.sha1(der).hexdigest().upper() in identities
                        and re.search(
                            rf'{hashlib.sha1(der).hexdigest().upper()} "Apple Distribution:',
                            identities)), None)
    if certificate is None:
        raise ValueError('The profile does not match a valid Apple Distribution certificate with a private key in the imported .p12.')
    return team, profile_uuid, certificate


def configure_project(source, version, build, team, profile_uuid, certificate):
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?', version):
        raise ValueError('Invalid app version.')
    if not re.fullmatch(r'[1-9]\d{0,3}(?:\.\d{1,2}){0,2}', build):
        raise ValueError('Invalid build number.')
    pattern = r'(\b[A-F0-9]{24} /\* Release \*/ = \{\s*isa = XCBuildConfiguration;\s*buildSettings = \{)(.*?)(\n\t\t\t\};\s*name = Release;\s*\};)'
    changed = 0

    def update(match):
        nonlocal changed
        settings = match[2]
        if not re.search(r'PRODUCT_BUNDLE_IDENTIFIER = ' + re.escape(BUNDLE_ID) + r';', settings):
            return match[0]
        values = {
            'CODE_SIGN_STYLE': 'Manual',
            'CODE_SIGN_IDENTITY': f'"{certificate}"',
            'DEVELOPMENT_TEAM': team,
            'PROVISIONING_PROFILE_SPECIFIER': f'"{profile_uuid}"',
            'CURRENT_PROJECT_VERSION': build,
            'MARKETING_VERSION': version,
        }
        for key, value in values.items():
            setting = rf'\b{key} = [^;]*;'
            replacement = f'{key} = {value};'
            if re.search(setting, settings):
                settings = re.sub(setting, lambda _: replacement, settings)
            else:
                settings += f'\n\t\t\t\t{replacement}'
        changed += 1
        return match[1] + settings + match[3]

    result = re.sub(pattern, update, source, flags=re.DOTALL)
    if changed != 1:
        raise ValueError('Expected exactly one SetGo Release target. Review the Xcode project before releasing.')
    return result


def main():
    signing = Path(os.environ['RUNNER_TEMP']) / 'setgo-signing'
    profile = plistlib.loads((signing / 'profile.plist').read_bytes())
    team, profile_uuid, certificate = validate_profile(
        profile, (signing / 'identities.txt').read_text())
    project = Path('ios/App/App.xcodeproj/project.pbxproj')
    project.write_text(configure_project(
        project.read_text(), os.environ['RELEASE_VERSION'], os.environ['RELEASE_BUILD'],
        team, profile_uuid, certificate))
    # Install in both the legacy and Xcode 16+ profile search locations.
    for location in ['Library/MobileDevice/Provisioning Profiles',
                     'Library/Developer/Xcode/UserData/Provisioning Profiles']:
        directory = Path.home() / location
        directory.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(signing / 'profile.mobileprovision', directory / f'{profile_uuid}.mobileprovision')
    options = {
        'method': 'app-store-connect',
        'destination': 'upload',
        'teamID': team,
        'signingStyle': 'manual',
        'signingCertificate': certificate,
        'provisioningProfiles': {BUNDLE_ID: profile_uuid},
        'manageAppVersionAndBuildNumber': False,
        'uploadSymbols': True,
    }
    (signing / 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
    print(f'Validated App Store signing for {BUNDLE_ID}; release settings are ready.')


if __name__ == '__main__':
    main()
