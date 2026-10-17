export type PaymentMethodView = {
  id: string;
  rentalPropertyId: string;
  name: string;
  recipient: string;
  url: string;
  enabled: boolean;
  version: number;
};
export type PaymentSettings = {
  scope: string;
  properties: Array<{ id: string; name: string }>;
  methods: PaymentMethodView[];
};
export type PaymentWorkspace = {
  scope: string;
  reservationId: string;
  revision: string;
  booking: string;
  currency: string;
  total: string;
  paid: string;
  refunded: string;
  remaining: string;
  deposit: string;
  paymentCollect: string | null;
  status: string;
  method: PaymentMethodView | null;
  history: Array<{
    id: string;
    amount: string;
    createdAt: string;
    stale: boolean;
  }>;
};
export type PreparedPayment = {
  id: string;
  text: string;
  amount: string;
  recipient: string;
  url: string;
  createdAt: string;
};
