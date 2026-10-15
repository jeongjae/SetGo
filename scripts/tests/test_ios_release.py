"""Release checks must reject signing assets for the wrong app or distribution method."""

import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'prepare-ios-release.py'
SPEC = importlib.util.spec_from_file_location('ios_release', SCRIPT)
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class SigningValidationTest(unittest.TestCase):
    def setUp(self):
        self.der = b'test certificate, not a real signing credential'
        self.fingerprint = hashlib.sha1(self.der).hexdigest().upper()
        self.identities = f'  1) {self.fingerprint} "Apple Distribution: Test (ABCDEFGHIJ)"\n'
        self.now = datetime(2026, 10, 15, tzinfo=timezone.utc)
        self.profile = {
            'ExpirationDate': datetime(2027, 1, 1),
            'Entitlements': {
                'application-identifier': 'ABCDEFGHIJ.app.setgo.mobile',
                'com.apple.developer.team-identifier': 'ABCDEFGHIJ',
                'get-task-allow': False,
                'beta-reports-active': True,
            },
            'TeamIdentifier': ['ABCDEFGHIJ'],
            'ApplicationIdentifierPrefix': ['ABCDEFGHIJ'],
            'UUID': '12345678-1234-1234-1234-123456789abc',
            'DeveloperCertificates': [self.der],
        }

    def validate(self, profile=None, identities=None):
        return release.validate_profile(
            self.profile if profile is None else profile,
            self.identities if identities is None else identities, self.now)

    def test_accepts_matching_distribution_identity(self):
        team, profile_uuid, certificate = self.validate()
        self.assertEqual(team, 'ABCDEFGHIJ')
        self.assertEqual(profile_uuid, self.profile['UUID'].upper())
        self.assertEqual(certificate, self.fingerprint)

    def test_accepts_legacy_app_id_prefix_separate_from_team(self):
        self.profile['ApplicationIdentifierPrefix'] = ['LEGACYPREF']
        self.profile['Entitlements']['application-identifier'] = 'LEGACYPREF.app.setgo.mobile'
        self.validate()

    def test_rejects_expired_profile(self):
        self.profile['ExpirationDate'] = datetime(2026, 10, 14)
        with self.assertRaisesRegex(ValueError, 'expired'):
            self.validate()

    def test_rejects_wrong_app_and_wildcard(self):
        for app_id in ['ABCDEFGHIJ.some.other.app', 'ABCDEFGHIJ.*']:
            with self.subTest(app_id=app_id):
                self.profile['Entitlements']['application-identifier'] = app_id
                with self.assertRaisesRegex(ValueError, 'explicitly identify'):
                    self.validate()

    def test_rejects_device_and_enterprise_distribution(self):
        for change in [{'ProvisionedDevices': []}, {'ProvisionsAllDevices': True}]:
            with self.subTest(change=change):
                profile = dict(self.profile, **change)
                with self.assertRaisesRegex(ValueError, 'distribution profile'):
                    self.validate(profile)

    def test_rejects_development_profile_and_missing_beta_entitlement(self):
        for change in [{'get-task-allow': True}, {'beta-reports-active': False}]:
            with self.subTest(change=change):
                profile = copy.deepcopy(self.profile)
                profile['Entitlements'].update(change)
                with self.assertRaisesRegex(ValueError, 'distribution profile'):
                    self.validate(profile)

    def test_rejects_mismatched_team(self):
        self.profile['TeamIdentifier'] = ['1234567890']
        with self.assertRaisesRegex(ValueError, 'do not match'):
            self.validate()

    def test_requires_private_key_matching_profile_certificate(self):
        with self.assertRaisesRegex(ValueError, 'private key'):
            self.validate(identities='0 valid identities found')

    def test_requires_distribution_identity(self):
        with self.assertRaisesRegex(ValueError, 'Apple Distribution'):
            self.validate(identities=self.identities.replace('Apple Distribution:', 'Apple Development:'))


class ProjectConfigurationTest(unittest.TestCase):
    def test_only_release_app_target_changes(self):
        project = SCRIPT.parents[1] / 'ios/App/App.xcodeproj/project.pbxproj'
        source = project.read_text()
        configured = release.configure_project(source, '1.0.0', '2', 'ABCDEFGHIJ',
                                               '12345678-1234-1234-1234-123456789ABC', 'A' * 40)
        # Debug still has its original version and automatic signing.
        self.assertEqual(configured.count('CODE_SIGN_STYLE = Automatic;'), 1)
        self.assertEqual(configured.count('CODE_SIGN_STYLE = Manual;'), 1)
        self.assertEqual(configured.count('CURRENT_PROJECT_VERSION = 1;'), 1)
        self.assertEqual(configured.count('CURRENT_PROJECT_VERSION = 2;'), 1)
        self.assertEqual(configured.count('MARKETING_VERSION = 1.0.0;'), 1)
        self.assertEqual(configured.count('DEVELOPMENT_TEAM = ABCDEFGHIJ;'), 1)
        self.assertEqual(configured.count('PRODUCT_BUNDLE_IDENTIFIER = app.setgo.mobile;'), 2)

    def test_refuses_changed_project_structure(self):
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            release.configure_project('unrecognized project', '1.0', '2', '', '', '')

    def test_rejects_malformed_versions_before_project_changes(self):
        for version, build in [('1.0; bad', '2'), ('1.0', '0'), ('1.0', '2; bad'), ('1.0', '10000')]:
            with self.subTest(version=version, build=build):
                with self.assertRaises(ValueError):
                    release.configure_project('', version, build, '', '', '')


if __name__ == '__main__':
    unittest.main()
