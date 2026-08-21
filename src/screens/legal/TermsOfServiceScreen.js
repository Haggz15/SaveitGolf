import LegalDocument from '../../components/legal/LegalDocument';
import { TERMS_OF_SERVICE } from '../../data/legalContent';

export default function TermsOfServiceScreen({ navigation }) {
  return <LegalDocument navigation={navigation} title="Terms of Service" sections={TERMS_OF_SERVICE} />;
}
