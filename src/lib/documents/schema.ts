import { z } from "zod";

export const DOCUMENT_TYPES = ["CONTRACT", "INVOICE", "ACT"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const optionalText = (max = 240) => z.string().trim().max(max).optional().default("");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату");

export const documentProfileSchema = z.object({
  entityType: z.enum(["INDIVIDUAL_ENTREPRENEUR", "LEGAL_ENTITY", "INDIVIDUAL"]),
  legalName: z.string().trim().min(2, "Укажите полное наименование").max(240),
  iinBin: z.string().trim().regex(/^\d{12}$/, "ИИН/БИН должен содержать 12 цифр"),
  identityDocument: optionalText(),
  postalCode: optionalText(20),
  legalAddress: z.string().trim().min(5, "Укажите юридический адрес").max(500),
  phone: optionalText(40),
  email: z.string().trim().email("Некорректный email").or(z.literal("")).default(""),
  bankName: optionalText(),
  iban: z.string().trim().toUpperCase().regex(/^KZ[A-Z0-9]{18}$/, "IBAN должен начинаться с KZ и содержать 20 символов").or(z.literal("")).default(""),
  bic: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,11}$/, "Укажите корректный БИК").or(z.literal("")).default(""),
  kbe: optionalText(8),
  signerName: z.string().trim().min(2, "Укажите ФИО подписанта").max(160),
  signerTitle: z.string().trim().min(2, "Укажите должность").max(120),
  signerAuthority: optionalText(),
  accountantName: optionalText(160),
  vatMode: z.enum(["WITHOUT_VAT", "VAT"]),
  vatRegistrationNumber: optionalText(40),
  defaultPaymentTerms: z.string().trim().min(2).max(240),
});

export type DocumentProfileInput = z.infer<typeof documentProfileSchema>;

export const createDocumentSchema = z.object({
  reservationId: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES),
  documentDate: isoDate,
  customerType: z.enum(["INDIVIDUAL", "COMPANY"]),
  guestFullName: z.string().trim().min(2, "Укажите ФИО гостя").max(160),
  guestIin: optionalText(12),
  guestIdentityDocument: optionalText(),
  companyName: optionalText(),
  companyBin: optionalText(12),
  companyAddress: optionalText(500),
  companyIban: optionalText(34),
  companyBic: optionalText(11),
  companyBankName: optionalText(),
  representativeName: optionalText(160),
  representativeIin: optionalText(12),
  representativeTitle: optionalText(120),
  representativeAuthority: optionalText(),
  propertyAddress: z.string().trim().min(5, "Укажите адрес квартиры").max(500),
  checkIn: isoDate,
  checkOut: isoDate,
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, "Укажите время заезда"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Укажите время выезда"),
  unit: z.string().trim().min(1).max(40),
  quantity: z.coerce.number().positive("Количество должно быть больше нуля").max(9999),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000),
  totalAmount: z.coerce.number().nonnegative().max(1_000_000_000),
  serviceDescription: z.string().trim().min(5).max(1000),
  contractReference: optionalText(),
  paymentTerms: z.string().trim().min(2).max(240),
  completionDate: isoDate,
  maxGuests: z.coerce.number().int().min(1).max(30),
  keyLossFine: z.coerce.number().nonnegative().max(10_000_000),
  customerSignerName: optionalText(160),
  customerSignerTitle: optionalText(120),
  issuedByName: optionalText(160),
}).superRefine((value, ctx) => {
  if (value.checkOut <= value.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Дата выезда должна быть позже даты заезда" });
  if (value.customerType === "INDIVIDUAL" && !/^\d{12}$/.test(value.guestIin)) {
    ctx.addIssue({ code: "custom", path: ["guestIin"], message: "ИИН должен содержать 12 цифр" });
  }
  if (value.type === "CONTRACT" && value.customerType === "INDIVIDUAL" && !value.guestIdentityDocument) {
    ctx.addIssue({ code: "custom", path: ["guestIdentityDocument"], message: "Укажите документ гостя" });
  }
  if (value.customerType === "COMPANY") {
    if (!value.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: "Укажите наименование компании" });
    if (!/^\d{12}$/.test(value.companyBin)) ctx.addIssue({ code: "custom", path: ["companyBin"], message: "БИН должен содержать 12 цифр" });
    if (!value.companyAddress) ctx.addIssue({ code: "custom", path: ["companyAddress"], message: "Укажите адрес компании" });
    if (!value.representativeName) ctx.addIssue({ code: "custom", path: ["representativeName"], message: "Укажите представителя" });
    if (value.type === "CONTRACT" && !/^\d{12}$/.test(value.representativeIin)) ctx.addIssue({ code: "custom", path: ["representativeIin"], message: "ИИН представителя должен содержать 12 цифр" });
  }
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export type DocumentProfileValues = DocumentProfileInput;

export interface DocumentDraft extends Omit<CreateDocumentInput, "reservationId" | "type"> {
  reservationId: string;
  type: DocumentType;
}

export interface GeneratedDocumentListItem {
  id: string;
  type: DocumentType;
  documentNumber: string;
  documentDate: string;
  createdAt: string;
}
