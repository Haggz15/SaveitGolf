import LegalDocument from '../../components/legal/LegalDocument';
import { PRIVACY_POLICY } from '../../data/legalContent';

export default function PrivacyPolicyScreen({ navigation }) {
  return <LegalDocument navigation={navigation} title="Privacy Policy" sections={PRIVACY_POLICY} />;
}
