import {
  contactText,
  conversationalText,
} from "@/shared/validation/contact-text";
import { personName } from "@/modules/contact/person-name";
export { contactText } from "@/shared/validation/contact-text";
export const homeownerNameSchema = personName(160);
export const additionalInfoSchema = conversationalText(4_000, true).optional();
