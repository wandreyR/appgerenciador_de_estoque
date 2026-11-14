export type Category = { id: number; name: string; product_count: number };

export type VariantT = {
  id: number;
  size: string;
  sku: string;
  quantity: number;
  min_stock: number;
  low: boolean;
};

export type ColorT = {
  id: number;
  name: string;
  hex: string;
  position: number;
  image_url: string | null;
  thumb_url: string | null;
  variants: VariantT[];
};

export type Product = {
  id: number;
  name: string;
  sku_base: string;
  category_id: number;
  category_name: string;
  cost_price: number;
  sale_price: number;
  notes: string | null;
  image_url: string | null;
  thumb_url: string | null;
  colors: ColorT[];
  sizes: string[];
  total_quantity: number;
  low_stock_count: number;
  created_at: string;
  updated_at: string;
};

export type FlatVariant = {
  id: number;
  sku: string;
  size: string;
  quantity: number;
  min_stock: number;
  low: boolean;
  product_id: number;
  product_name: string;
  sku_base: string;
  category_id: number;
  category_name: string;
  color_id: number;
  color_name: string;
  color_hex: string;
  sale_price: number;
  cost_price: number;
  image_url: string | null;
  thumb_url: string | null;
};

export type Customer = {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
  order_count?: number;
};

export type OrderStatus = "pendente" | "separado" | "entregue" | "cancelado";

export type OrderItem = {
  id: number;
  variant_id: number | null;
  product_name: string;
  sku: string;
  color_name: string;
  color_hex: string;
  size: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url: string | null;
  thumb_url: string | null;
};

export type Order = {
  id: number;
  number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_document: string | null;
  customer_address: string | null;
  customer_city: string | null;
  status: OrderStatus;
  notes: string | null;
  total: number;
  total_pieces: number;
  item_count: number;
  created_at: string;
  separated_at: string | null;
  separated_by: string | null;
  cancelled_at: string | null;
  items?: OrderItem[];
};

export type Movement = {
  id: number;
  variant_id: number | null;
  description: string;
  kind: string;
  delta: number;
  balance_after: number;
  reason: string | null;
  order_id: number | null;
  created_at: string;
};

export type DashboardData = {
  total_pieces: number;
  stock_cost_value: number;
  stock_sale_value: number;
  variant_count: number;
  product_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_orders: number;
  separated_orders: number;
  month_sales: number;
  month_orders: number;
  low_stock: FlatVariant[];
  pending_list: Order[];
};

export type LicenseStatus = {
  status: string;
  valid: boolean;
  lifetime: boolean;
  message: string;
  hwid: string;
  customer: string | null;
  issued: string | null;
  expires: string | null;
  days_left: number | null;
  license_id: string | null;
  days_since_check: number | null;
  check_enabled: boolean;
  grace_days: number;
  app_name: string;
  version: string;
};

export type Settings = {
  company_name: string;
  company_document: string;
  company_phone: string;
  company_address: string;
  company_city: string;
  print_footer: string;
};
