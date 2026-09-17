import path from "node:path";
import PDFDocument from "pdfkit";
import type { CreateDocumentInput, DocumentProfileValues, DocumentType } from "@/lib/documents/schema";
import { officialDocumentNumber } from "@/lib/documents/numbers";

interface DocumentSnapshot {
  version: number;
  type: DocumentType;
  documentNumber: string;
  documentDate: string;
  currency: string;
  city: string;
  hotelName: string;
  profile: DocumentProfileValues;
  data: CreateDocumentInput;
}

const TINOS_REGULAR = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "tinos", "400Regular", "Tinos_400Regular.ttf");
const TINOS_ITALIC = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "tinos", "400Regular_Italic", "Tinos_400Regular_Italic.ttf");
const TINOS_BOLD = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "tinos", "700Bold", "Tinos_700Bold.ttf");
const ARIMO_REGULAR = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "roboto", "400Regular", "Roboto_400Regular.ttf");
const ARIMO_ITALIC = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "roboto", "400Regular_Italic", "Roboto_400Regular_Italic.ttf");
const ARIMO_BOLD = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "roboto", "700Bold", "Roboto_700Bold.ttf");

const BLACK = "#000000";
const moneyNumber = (value: number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const longDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const partyName = (data: CreateDocumentInput) => data.customerType === "COMPANY" ? data.companyName : data.guestFullName;

function parseSnapshot(value: unknown): DocumentSnapshot {
  if (!value || typeof value !== "object") throw new Error("Некорректный снимок документа");
  const snapshot = value as DocumentSnapshot;
  if (!snapshot.profile || !snapshot.data || !snapshot.type || !snapshot.documentNumber) throw new Error("Некорректный снимок документа");
  return snapshot;
}

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Tinos", TINOS_REGULAR);
  doc.registerFont("Tinos-Italic", TINOS_ITALIC);
  doc.registerFont("Tinos-Bold", TINOS_BOLD);
  doc.registerFont("Arimo", ARIMO_REGULAR);
  doc.registerFont("Arimo-Italic", ARIMO_ITALIC);
  doc.registerFont("Arimo-Bold", ARIMO_BOLD);
}

function addPage(doc: PDFKit.PDFDocument, layout: "portrait" | "landscape" = "portrait", margins?: { top: number; right: number; bottom: number; left: number }) {
  doc.addPage({
    size: "A4",
    layout,
    margins: margins ?? (layout === "portrait"
      ? { top: 30, right: 56, bottom: 32, left: 56 }
      : { top: 28, right: 28, bottom: 28, left: 28 }),
  });
  doc.fillColor(BLACK);
}

function contractParagraph(doc: PDFKit.PDFDocument, value: string, indent = 31) {
  doc.font("Tinos").fontSize(10.35).text(value, { align: "justify", indent, lineGap: 0.25 }).moveDown(0.12);
}

function contractSection(doc: PDFKit.PDFDocument, value: string) {
  doc.moveDown(0.28).font("Tinos-Bold").fontSize(10.8).text(value, { align: "center" }).moveDown(0.12);
}

function integerWordsRu(input: number): string {
  const value = Math.max(0, Math.round(input));
  if (value === 0) return "ноль";
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const feminine = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const groups: Array<{ divisor: number; forms: [string, string, string]; female?: boolean }> = [
    { divisor: 1_000_000_000, forms: ["миллиард", "миллиарда", "миллиардов"] },
    { divisor: 1_000_000, forms: ["миллион", "миллиона", "миллионов"] },
    { divisor: 1_000, forms: ["тысяча", "тысячи", "тысяч"], female: true },
  ];
  const plural = (n: number, forms: [string, string, string]) => n % 100 >= 11 && n % 100 <= 19 ? forms[2] : n % 10 === 1 ? forms[0] : n % 10 >= 2 && n % 10 <= 4 ? forms[1] : forms[2];
  const triplet = (n: number, female = false) => {
    const result: string[] = [];
    if (Math.floor(n / 100)) result.push(hundreds[Math.floor(n / 100)]);
    const rest = n % 100;
    if (rest >= 10 && rest <= 19) result.push(teens[rest - 10]);
    else {
      if (Math.floor(rest / 10)) result.push(tens[Math.floor(rest / 10)]);
      if (rest % 10) result.push((female ? feminine : ones)[rest % 10]);
    }
    return result;
  };
  let remainder = value;
  const words: string[] = [];
  for (const group of groups) {
    const amount = Math.floor(remainder / group.divisor);
    if (amount) {
      words.push(...triplet(amount, group.female), plural(amount, group.forms));
      remainder %= group.divisor;
    }
  }
  words.push(...triplet(remainder));
  return words.join(" ");
}

function officialAmount(value: number, currency: string): string {
  const numeric = moneyNumber(value);
  if (currency !== "KZT") return `${numeric} ${currency}`;
  return `${numeric} (${integerWordsRu(value)}) тенге`;
}

function customerTaxId(data: CreateDocumentInput): string {
  return data.customerType === "COMPANY" ? data.companyBin : data.guestIin || "-";
}

function customerAddress(data: CreateDocumentInput): string {
  return data.customerType === "COMPANY" ? data.companyAddress : "-";
}

function contract(doc: PDFKit.PDFDocument, snapshot: DocumentSnapshot) {
  const profile = snapshot.profile;
  const data = snapshot.data;
  const number = officialDocumentNumber(snapshot.documentNumber);
  const tenant = data.customerType === "COMPANY"
    ? `${data.companyName}, БИН ${data.companyBin}, в лице ${data.representativeName}${data.representativeTitle ? `, ${data.representativeTitle}` : ""}${data.representativeAuthority ? `, действующего на основании ${data.representativeAuthority}` : ""}`
    : `${data.guestFullName}, ИИН ${data.guestIin}${data.guestIdentityDocument ? `, ${data.guestIdentityDocument}` : ""}`;

  addPage(doc);
  doc.font("Tinos-Bold").fontSize(12.2).text(`ДОГОВОР\nКРАТКОСРОЧНОГО НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ № ${number}`, { align: "center", lineGap: 0.5 });
  const dateY = doc.y + 1;
  doc.font("Tinos").fontSize(10.6).text(`город ${snapshot.city}`, 56, dateY, { width: 230 });
  doc.text(`${shortDate(snapshot.documentDate)} г.`, doc.page.width - 286, dateY, { width: 230, align: "right" });
  doc.x = doc.page.margins.left;
  doc.y = dateY + 27;
  contractParagraph(doc, `${profile.legalName}, ИИН/БИН ${profile.iinBin}${profile.identityDocument ? ` (${profile.identityDocument})` : ""}, именуемый(ая) в дальнейшем «Арендодатель», с одной стороны, и ${tenant}, именуемый(ая) в дальнейшем «Арендатор», с другой стороны, заключили настоящий договор краткосрочного найма жилого помещения («Договор») о нижеследующем.`, 0);
  doc.font("Tinos").fontSize(10.35).text("Далее по тексту «Арендодатель» и «Арендатор» совместно именуются «Стороны».", { align: "center" }).moveDown(0.45);
  contractSection(doc, "1.  ПРЕДМЕТ ДОГОВОРА");
  contractParagraph(doc, `1.1 Арендодатель сдаёт в имущественный наём (аренду), а Арендатор принимает во временное владение и пользование квартиру, расположенную по адресу: ${data.propertyAddress}, именуемую в дальнейшем «Квартира», на условиях, изложенных в настоящем Договоре.`);
  contractParagraph(doc, `1.2 Стандартное время заселения Арендатора в Квартиру - ${data.checkInTime}, если иное время заранее не оговорено Сторонами. Стандартное время выезда Арендатора из Квартиры - до ${data.checkOutTime}, если иное время заранее не оговорено Сторонами.`);
  contractParagraph(doc, "1.3 Стоимость проживания Арендатора в квартире с учётом раннего заезда и/или позднего выезда, а также время такого заезда и выезда согласовываются Сторонами отдельно.");
  contractParagraph(doc, `1.4 Срок найма Квартиры составляет ${data.quantity} ${data.unit}, начиная:\nсо времени заезда:  ${data.checkInTime}  ${shortDate(data.checkIn)} г.\nдо времени выезда: ${data.checkOutTime}  ${shortDate(data.checkOut)} г.`);
  contractSection(doc, "2.  ПОРЯДОК ОПЛАТЫ");
  doc.font("Tinos").fontSize(10.35).text("2.1 Арендная плата за пользование Квартирой в течение Срока найма, указанного в п. 1.4 настоящего Договора, составляет: ", { align: "justify", indent: 31, continued: true, lineGap: 0.25 });
  doc.font("Tinos-Bold").text(`${officialAmount(data.unitPrice, snapshot.currency)} за ${data.unit} и ${officialAmount(data.totalAmount, snapshot.currency)} за весь Срок найма.`, { align: "justify" }).moveDown(0.12);
  contractParagraph(doc, `2.2 Арендатор обязуется полностью оплатить проживание в Квартире в течение Срока найма. Условия оплаты: ${data.paymentTerms}. Арендодатель обязуется вернуть Арендатору депозит в момент освобождения Квартиры и передачи ключей, если депозит был принят и отсутствует ущерб.`);
  contractParagraph(doc, "2.3 При отмене бронирования, изменении даты заезда на более позднюю, изменении даты выезда на более раннюю либо несвоевременном уведомлении применяются условия отмены, согласованные Сторонами при подтверждении бронирования.");
  contractParagraph(doc, "2.4 Дополнительная уборка, смена белья и иные услуги, не указанные в настоящем Договоре, предоставляются за отдельную плату по согласованию с Арендодателем.");
  contractSection(doc, "3.  ПРАВА И ОБЯЗАННОСТИ СТОРОН");
  contractParagraph(doc, "3.1 Арендодатель обязан:");
  contractParagraph(doc, "3.1.1 предоставить Арендатору Квартиру в пригодном для проживания состоянии, передать доступ в согласованное время и ознакомить с правилами проживания;");
  contractParagraph(doc, "3.1.2 устранять неисправности, возникшие не по вине Арендатора, в разумный срок;");
  contractParagraph(doc, "3.1.3 передать Арендатору комплект ключей в момент заселения в Квартиру;");

  addPage(doc);
  contractParagraph(doc, "3.1.4 проводить влажную уборку и смену белья при длительном проживании на условиях, отдельно согласованных Сторонами.");
  contractParagraph(doc, "3.2 Арендодатель вправе:");
  contractParagraph(doc, "3.2.1 посещать Квартиру для уборки, проверки порядка использования и состояния имущества по предварительному согласованию с Арендатором. При аварии, пожаре, затоплении и иных неотложных обстоятельствах Арендодатель вправе получить доступ без предварительного согласования;");
  contractParagraph(doc, "3.2.2 потребовать освобождения Квартиры до истечения срока Договора при существенном нарушении Арендатором условий настоящего Договора и правил проживания;");
  contractParagraph(doc, "3.3 Арендатор обязан:");
  contractParagraph(doc, "3.3.1 обеспечивать сохранность Квартиры и находящегося в ней имущества, поддерживать Квартиру в надлежащем состоянии;");
  contractParagraph(doc, "3.3.2 возместить Арендодателю документально подтверждённую стоимость ремонта или замены имущества, повреждённого по вине Арендатора либо проживающих с ним лиц;");
  contractParagraph(doc, `3.3.3 использовать Квартиру исключительно для проживания и не допускать проживания более ${data.maxGuests} человек;`);
  contractParagraph(doc, "3.3.4 освободить Квартиру не позднее времени выезда, указанного в п. 1.2 Договора, если иное время не согласовано Сторонами;");
  contractParagraph(doc, "3.3.5 до выезда оплатить все согласованные платные услуги, возвратить ключи, соблюдать тишину с 22:00 до 09:00 и правила проживания;");
  contractParagraph(doc, "3.4 Арендодатель не несёт ответственности за оставленные без присмотра личные вещи Арендатора, кроме случаев, прямо предусмотренных законодательством.");
  contractParagraph(doc, "3.5 Арендатор не вправе передавать Квартиру в поднаём третьим лицам.");
  contractParagraph(doc, `3.6 За утерю ключей от Квартиры взимается штраф в размере ${officialAmount(data.keyLossFine, snapshot.currency)}.`);
  contractParagraph(doc, "3.7 В Квартире запрещается курить, проводить вечеринки и иные мероприятия, сопровождающиеся шумом, использовать открытый огонь и совершать противоправные действия.");
  contractParagraph(doc, "3.8 Если проживание станет невозможным вследствие аварии, пожара или иных технических факторов, Стороны согласовывают устранение препятствий, равноценное размещение либо возврат платы за неиспользованный период.");
  contractSection(doc, "4.  РАСТОРЖЕНИЕ ДОГОВОРА");
  contractParagraph(doc, "4.1 Договор может быть расторгнут по требованию Арендодателя при невыполнении условий Договора, причинении существенного ущерба, использовании Квартиры не по назначению либо наличии обоснованных жалоб соседей.");
  contractParagraph(doc, "4.2 Договор может быть расторгнут по требованию Арендатора при невыполнении Арендодателем условий настоящего Договора.");
  contractSection(doc, "5.  ОБЩИЕ ПОЛОЖЕНИЯ");
  contractParagraph(doc, "5.1 Настоящий Договор составлен, регулируется и подлежит толкованию в соответствии с законодательством Республики Казахстан.");
  contractParagraph(doc, "5.2 Взаимоотношения Сторон, не урегулированные Договором, регулируются законодательством Республики Казахстан.");
  contractParagraph(doc, "5.3 Споры передаются на рассмотрение в судебные органы в соответствии с законодательством Республики Казахстан.");
  contractSection(doc, "6.  ПОДПИСИ СТОРОН");

  addPage(doc);
  const width = (doc.page.width - 132) / 2;
  const leftX = 56;
  const rightX = leftX + width + 20;
  const startY = 48;
  doc.font("Tinos-Bold").fontSize(10.8).text("Арендодатель", leftX, startY, { width, align: "center" });
  doc.text("Арендатор", rightX, startY, { width, align: "center" });
  const landlordDetails = [profile.legalName, [profile.postalCode, profile.legalAddress].filter(Boolean).join(", "), profile.identityDocument ? `Документ: ${profile.identityDocument}` : "", `ИИН/БИН: ${profile.iinBin}`, profile.iban ? `ИИК: ${profile.iban}` : "", profile.bic ? `БИК: ${profile.bic}` : "", profile.bankName || ""].filter(Boolean).join("\n");
  const tenantDetails = data.customerType === "COMPANY"
    ? [data.companyName, `Адрес: ${data.companyAddress}`, `БИН: ${data.companyBin}`, data.companyBic ? `БИК: ${data.companyBic}` : "", data.companyIban ? `ИИК: ${data.companyIban}` : ""].filter(Boolean).join("\n")
    : [data.guestFullName, `ИИН: ${data.guestIin}`, data.guestIdentityDocument].filter(Boolean).join("\n");
  doc.font("Tinos").fontSize(10.2).text(landlordDetails, leftX, startY + 38, { width, lineGap: 2 });
  doc.text(tenantDetails, rightX, startY + 38, { width, lineGap: 2 });
  const signatureY = Math.max(doc.y + 35, startY + 210);
  doc.font("Tinos").fontSize(9.8).text(`${profile.signerTitle} ____________ ${profile.signerName}\n\nМ.П.`, leftX, signatureY, { width });
  doc.text(`${data.customerSignerTitle || "Арендатор"} ____________ ${data.customerSignerName || partyName(data)}\n\nМ.П. (при наличии)`, rightX, signatureY, { width });
}

function cell(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, text: string, options?: { bold?: boolean; italic?: boolean; align?: "left" | "center" | "right"; size?: number; padding?: number }) {
  doc.rect(x, y, width, height).stroke(BLACK);
  const font = options?.bold ? "Arimo-Bold" : options?.italic ? "Arimo-Italic" : "Arimo";
  const padding = options?.padding ?? 3;
  doc.font(font).fontSize(options?.size ?? 6.4).text(text, x + padding, y + padding, { width: width - padding * 2, height: height - padding * 2, align: options?.align ?? "center", lineGap: 0.1, ellipsis: false });
}

function ruledField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, boldValue = false) {
  doc.font("Arimo").fontSize(7.2).text(label, x, y, { continued: true });
  doc.font(boldValue ? "Arimo-Bold" : "Arimo").text(value);
  doc.moveTo(x, y + 11).lineTo(x + width, y + 11).stroke(BLACK);
}

function invoice(doc: PDFKit.PDFDocument, snapshot: DocumentSnapshot) {
  const profile = snapshot.profile;
  const data = snapshot.data;
  const number = officialDocumentNumber(snapshot.documentNumber);
  const tax = profile.vatMode === "VAT" ? "С НДС" : "Без НДС";
  addPage(doc, "portrait", { top: 28, right: 42, bottom: 32, left: 42 });
  doc.font("Arimo-Bold").fontSize(12.2).text(`Счет-фактура № ${number} от ${longDate(snapshot.documentDate)}`, { align: "center" });
  let y = doc.y + 13;
  const x = 42;
  const width = doc.page.width - 84;
  ruledField(doc, "Дата совершения оборота:     ", shortDate(data.completionDate || data.checkOut), x, y, width); y += 13;
  ruledField(doc, "Поставщик: ", profile.legalName, x, y, width, true); y += 13;
  ruledField(doc, "БИН и адрес места нахождения поставщика: ", `${profile.iinBin}, ${[profile.postalCode, profile.legalAddress].filter(Boolean).join(", ")}`, x, y, width); y += 13;
  ruledField(doc, "ИИК поставщика: ", `${profile.iban || "-"}, в банке ${profile.bankName || "-"}, БИК ${profile.bic || "-"}`, x, y, width); y += 13;
  ruledField(doc, "Договор (контракт) на поставку товаров (работ, услуг): ", data.contractReference || `Договор № ${number} от ${shortDate(data.checkIn)} г.`, x, y, width); y += 13;
  ruledField(doc, "Условия оплаты по договору (контракту): ", data.paymentTerms, x, y, width); y += 13;
  ruledField(doc, "Пункт назначения поставляемых товаров (работ, услуг): ", data.propertyAddress, x, y, width); y += 13;
  ruledField(doc, "Поставка товаров (работ, услуг) осуществлена по доверенности: ", "Без доверенности", x, y, width); y += 13;
  ruledField(doc, "Способ отправления: ", "99 (Прочие)", x, y, width); y += 13;
  ruledField(doc, "Товарно-транспортная накладная: ", "-", x, y, width); y += 13;
  ruledField(doc, "Грузоотправитель: ", `${profile.iinBin}, ${profile.legalName}, ${profile.legalAddress}`, x, y, width); y += 20;
  ruledField(doc, "Грузополучатель: ", `${customerTaxId(data)}, ${partyName(data)}`, x, y, width); y += 20;
  ruledField(doc, "Получатель: ", partyName(data), x, y, width, true); y += 13;
  ruledField(doc, "БИН и адрес места нахождения получателя: ", `${customerTaxId(data)}, ${customerAddress(data)}`, x, y, width); y += 13;
  ruledField(doc, "ИИК получателя: ", data.customerType === "COMPANY" ? `${data.companyIban || "-"}, БИК ${data.companyBic || "-"}` : "-", x, y, width); y += 19;

  const widths = [22, 104, 42, 42, 51, 62, 39, 47, 58, 37, 47];
  const labels = ["№\nп/п", "Наименование\nтоваров (работ, услуг)", "Ед. изм.", "Кол-во\n(объем)", "Цена", "Стоимость\nбез НДС"];
  let cx = x;
  labels.forEach((label, index) => { cell(doc, cx, y, widths[index], 44, label, { size: 6.2 }); cx += widths[index]; });
  cell(doc, cx, y, widths[6] + widths[7], 22, "НДС", { size: 6.2 });
  cell(doc, cx, y + 22, widths[6], 22, "Ставка", { size: 5.9 });
  cell(doc, cx + widths[6], y + 22, widths[7], 22, "Сумма", { size: 5.9 });
  cx += widths[6] + widths[7];
  cell(doc, cx, y, widths[8], 44, "Всего\nстоимость", { size: 6.2 });
  cx += widths[8];
  cell(doc, cx, y, widths[9] + widths[10], 22, "Акциз", { size: 6.2 });
  cell(doc, cx, y + 22, widths[9], 22, "Ставка", { size: 5.9 });
  cell(doc, cx + widths[9], y + 22, widths[10], 22, "Сумма", { size: 5.9 });
  y += 44;
  cx = x;
  widths.forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 10, String(index + 1), { italic: true, size: 5.4 }); cx += columnWidth; });
  y += 10;
  const values = ["1", data.serviceDescription, data.unit, String(data.quantity), moneyNumber(data.unitPrice), moneyNumber(data.totalAmount), tax, "", moneyNumber(data.totalAmount), "", ""];
  cx = x;
  widths.forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 66, values[index], { align: index === 1 ? "left" : index >= 4 ? "right" : "center", size: 6.3 }); cx += columnWidth; });
  y += 66;
  cell(doc, x, y, widths.slice(0, 5).reduce((sum, item) => sum + item, 0), 13, "Итого", { bold: true, align: "right", size: 6.4 });
  cx = x + widths.slice(0, 5).reduce((sum, item) => sum + item, 0);
  widths.slice(5).forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 13, index === 0 || index === 3 ? moneyNumber(data.totalAmount) : "", { bold: true, align: "right", size: 6.3 }); cx += columnWidth; });
  y += 27;
  const half = (width - 34) / 2;
  doc.font("Arimo-Bold").fontSize(7.2).text(`Руководитель: ${profile.signerName}`, x, y, { width: half });
  doc.moveTo(x, y + 16).lineTo(x + half, y + 16).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(5.5).text("(Ф.И.О., подпись)", x, y + 18, { width: half, align: "center" });
  doc.font("Arimo-Bold").fontSize(7.2).text("ВЫДАЛ (ответственное лицо поставщика)", x + half + 34, y, { width: half, align: "center" });
  doc.moveTo(x + half + 34, y + 16).lineTo(x + width, y + 16).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(5.5).text("(должность, Ф.И.О., подпись)", x + half + 34, y + 18, { width: half, align: "center" });
  y += 39;
  doc.font("Arimo-Bold").fontSize(7.2).text(`Главный бухгалтер: ${profile.accountantName || "Не предусмотрен"}`, x, y, { width: half });
  doc.moveTo(x, y + 16).lineTo(x + half, y + 16).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(5.5).text("(Ф.И.О., подпись)", x, y + 18, { width: half, align: "center" });
  doc.font("Arimo-Bold").fontSize(7).text("Б.П.", x + 20, y + 39);
}

function act(doc: PDFKit.PDFDocument, snapshot: DocumentSnapshot) {
  const profile = snapshot.profile;
  const data = snapshot.data;
  const number = officialDocumentNumber(snapshot.documentNumber);
  addPage(doc, "landscape", { top: 25, right: 29, bottom: 26, left: 29 });
  const pageWidth = doc.page.width;
  const x = 29;
  const usable = pageWidth - 58;
  doc.font("Arimo-Italic").fontSize(7.2).text("Приложение 50\nк приказу Министра финансов\nРеспублики Казахстан\nот 20 декабря 2012 года № 562", pageWidth - 210, 28, { width: 170, align: "right", lineGap: 1 });
  doc.font("Arimo").fontSize(7.3).text("Форма Р-1", pageWidth - 150, 88, { width: 110, align: "right" });
  let y = 116;
  const labelWidth = 66;
  const partyWidth = 455;
  doc.font("Arimo").fontSize(7.2).text("Заказчик", x, y + 13, { width: labelWidth });
  doc.font("Arimo-Bold").fontSize(8.5).text(partyName(data), x + labelWidth, y, { width: partyWidth, align: "center" });
  doc.moveTo(x + labelWidth, y + 24).lineTo(x + labelWidth + partyWidth, y + 24).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(6.2).text("полное наименование, адрес, данные о средствах связи", x + labelWidth, y + 26, { width: partyWidth, align: "center" });
  cell(doc, pageWidth - 129, y - 2, 100, 24, customerTaxId(data), { bold: true, size: 8.2 });
  doc.font("Arimo").fontSize(7).text("ИИН/БИН", pageWidth - 129, y - 16, { width: 100, align: "center" });
  y += 33;
  doc.font("Arimo").fontSize(7.2).text("Исполнитель", x, y + 4, { width: labelWidth });
  doc.font("Arimo-Bold").fontSize(8.2).text(`${profile.legalName}, ${[profile.postalCode, profile.legalAddress].filter(Boolean).join(", ")}`, x + labelWidth, y, { width: partyWidth, align: "center" });
  doc.moveTo(x + labelWidth, y + 16).lineTo(x + labelWidth + partyWidth, y + 16).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(6.2).text("полное наименование, адрес, данные о средствах связи", x + labelWidth, y + 18, { width: partyWidth, align: "center" });
  cell(doc, pageWidth - 129, y - 1, 100, 13, profile.iinBin, { bold: true, size: 7.6 });
  y += 27;
  doc.font("Arimo").fontSize(7.2).text("Договор (контракт)", x, y + 2, { width: 82 });
  doc.text(data.contractReference || `Договор № ${number} от ${shortDate(data.checkIn)} г.`, x + 82, y, { width: 345 });
  doc.moveTo(x + 82, y + 13).lineTo(x + 427, y + 13).stroke(BLACK);
  const boxX = x + 485;
  cell(doc, boxX, y - 10, 58, 31, "Номер\nдокумента", { size: 6.8 });
  cell(doc, boxX + 58, y - 10, 58, 31, "Дата\nсоставления", { size: 6.8 });
  cell(doc, boxX, y + 21, 58, 15, number, { bold: true, size: 7.2 });
  cell(doc, boxX + 58, y + 21, 58, 15, shortDate(snapshot.documentDate), { bold: true, size: 7.2 });
  y += 38;
  doc.font("Arimo-Bold").fontSize(10.2).text("АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)", x, y, { width: 520, align: "center" });
  y += 25;

  const widths = [35, 190, 67, 138, 44, 67, 80, usable - 621];
  const headers = ["Номер\nпо\nпорядку", "Наименование работ (услуг) (в разрезе их видов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)", "Дата\nвыполнения\nработ (оказания\nуслуг)", "Сведения об отчете о научных исследованиях, маркетинговых, консультационных и прочих услугах", "Единица\nизмерения"];
  let cx = x;
  headers.forEach((header, index) => { cell(doc, cx, y, widths[index], 52, header, { size: index === 1 || index === 3 ? 6.2 : 6.5 }); cx += widths[index]; });
  const workWidth = widths.slice(5).reduce((sum, item) => sum + item, 0);
  cell(doc, cx, y, workWidth, 25, "Выполнено работ (оказано услуг)", { size: 6.4 });
  cell(doc, cx, y + 25, widths[5], 27, "количество", { size: 6.1 });
  cell(doc, cx + widths[5], y + 25, widths[6], 27, "цена за единицу", { size: 6.1 });
  cell(doc, cx + widths[5] + widths[6], y + 25, widths[7], 27, "стоимость", { size: 6.1 });
  y += 52;
  cx = x;
  widths.forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 10, String(index + 1), { size: 5.5 }); cx += columnWidth; });
  y += 10;
  const row = ["1", data.serviceDescription, shortDate(data.completionDate), "", data.unit, String(data.quantity), moneyNumber(data.unitPrice), moneyNumber(data.totalAmount)];
  cx = x;
  widths.forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 35, row[index], { align: index === 1 ? "left" : "center", size: 6.3 }); cx += columnWidth; });
  y += 35;
  cell(doc, x, y, widths.slice(0, 5).reduce((sum, item) => sum + item, 0), 12, "Итого", { align: "right", size: 6.2 });
  cx = x + widths.slice(0, 5).reduce((sum, item) => sum + item, 0);
  widths.slice(5).forEach((columnWidth, index) => { cell(doc, cx, y, columnWidth, 12, index === 0 ? String(data.quantity) : index === 1 ? "x" : moneyNumber(data.totalAmount), { size: 6.3 }); cx += columnWidth; });
  y += 31;
  doc.font("Arimo").fontSize(7.1).text("Сведения об использовании запасов, полученных от заказчика", x, y, { continued: true });
  doc.moveTo(x + 235, y + 10).lineTo(x + usable, y + 10).stroke(BLACK);
  doc.font("Arimo-Italic").fontSize(6).text("наименование, количество, стоимость", x + 235, y + 12, { width: usable - 235, align: "center" });
  y += 31;
  doc.font("Arimo").fontSize(7.1).text("Приложение: Перечень документации, в том числе отчёты и иные материалы (при их наличии)", x, y);
  doc.moveTo(x + 500, y + 10).lineTo(x + usable, y + 10).stroke(BLACK);
  y += 39;
  const half = (usable - 35) / 2;
  doc.font("Arimo").fontSize(7.1).text("Сдал (Исполнитель)", x, y, { continued: true });
  doc.font("Arimo-Bold").text(`    ${profile.signerTitle}  /  __________________  /  ${profile.signerName}`, { width: half - 90 });
  doc.font("Arimo").fontSize(7.1).text("Принял (Заказчик)", x + half + 35, y, { continued: true });
  doc.font("Arimo-Bold").text(`    ${data.customerSignerTitle || "должность"}  /  ________________  /  ${data.customerSignerName || partyName(data)}`, { width: half - 90 });
  y += 28;
  doc.font("Arimo-Bold").fontSize(7.1).text("Без печати", x + 20, y);
  doc.font("Arimo").text(`Дата подписания (принятия) работ (услуг)    ${shortDate(data.completionDate)}`, x + half + 35, y, { width: half });
  doc.moveTo(x + half + 240, y + 11).lineTo(x + half + 330, y + 11).stroke(BLACK);
  doc.font("Arimo-Bold").text("М.П.", x + half + 50, y + 24);
}

export async function renderDocumentPdf(value: unknown): Promise<Buffer> {
  const snapshot = parseSnapshot(value);
  const number = officialDocumentNumber(snapshot.documentNumber);
  const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Title: `${snapshot.type} ${number}`, Author: snapshot.profile.legalName, Creator: "Shanyraq AI" } });
  registerFonts(doc);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (snapshot.type === "CONTRACT") contract(doc, snapshot);
  else if (snapshot.type === "INVOICE") invoice(doc, snapshot);
  else act(doc, snapshot);
  doc.end();
  return result;
}
