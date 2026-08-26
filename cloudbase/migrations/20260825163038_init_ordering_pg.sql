-- 馒有意思点单系统 CloudBase PostgreSQL 初始结构。
-- 所有业务表仅由 ordering-api 云函数使用 service_role 访问，前端不直接读写。

CREATE TABLE public.products (
  id text PRIMARY KEY,
  name varchar(60) NOT NULL,
  description varchar(160) NOT NULL DEFAULT '',
  price numeric(10, 2) NOT NULL CHECK (price > 0),
  unit varchar(10) NOT NULL DEFAULT '个',
  category varchar(20) NOT NULL DEFAULT '经典',
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  badge varchar(20) NOT NULL DEFAULT '',
  image_file_id text NOT NULL DEFAULT '',
  tone varchar(20) NOT NULL DEFAULT 'wheat',
  available boolean NOT NULL DEFAULT true,
  sort_order bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.store_settings (
  id text PRIMARY KEY,
  brand_mark varchar(2) NOT NULL DEFAULT '馒',
  brand_name varchar(40) NOT NULL,
  brand_tagline varchar(80) NOT NULL DEFAULT '',
  hero_badge varchar(80) NOT NULL DEFAULT '',
  hero_title varchar(120) NOT NULL,
  hero_description varchar(300) NOT NULL DEFAULT '',
  hero_button_text varchar(40) NOT NULL DEFAULT '看看今日馒头',
  delivery_note varchar(160) NOT NULL DEFAULT '',
  hero_background_file_id text NOT NULL DEFAULT '',
  delivery_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_range_km numeric(5, 2) NOT NULL DEFAULT 3 CHECK (delivery_range_km > 0),
  delivery_minimum numeric(10, 2) NOT NULL DEFAULT 15 CHECK (delivery_minimum >= 0),
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 3 CHECK (delivery_fee >= 0),
  free_delivery_threshold numeric(10, 2) NOT NULL DEFAULT 30 CHECK (free_delivery_threshold >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_methods (
  id text PRIMARY KEY,
  name varchar(40) NOT NULL,
  payee_name varchar(40) NOT NULL,
  qr_code_url text NOT NULL,
  note varchar(200) NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id text PRIMARY KEY,
  short_code varchar(4) NOT NULL UNIQUE,
  access_token_hash char(64) NOT NULL UNIQUE,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  subtotal numeric(10, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee numeric(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(10, 2) NOT NULL CHECK (total >= 0),
  order_type varchar(12) NOT NULL CHECK (order_type IN ('pickup', 'delivery')),
  customer_name varchar(40) NOT NULL,
  phone varchar(20) NOT NULL,
  address varchar(200) NOT NULL DEFAULT '',
  delivery_area varchar(80) NOT NULL DEFAULT '',
  door_number varchar(120) NOT NULL DEFAULT '',
  pickup_day varchar(20) NOT NULL DEFAULT '',
  pickup_time varchar(30) NOT NULL DEFAULT '',
  delivery_time varchar(30) NOT NULL DEFAULT '',
  remark varchar(200) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  delivery_status varchar(20) NOT NULL DEFAULT 'waiting' CHECK (delivery_status IN ('waiting', 'delivering', 'delivered')),
  payment_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'submitted', 'confirmed', 'rejected')),
  payment_reference varchar(80) NOT NULL DEFAULT '',
  payment_method_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX orders_access_token_hash_idx ON public.orders (access_token_hash);

CREATE TABLE public.order_counters (
  id text PRIMARY KEY,
  counter_date date NOT NULL,
  prefix char(1) NOT NULL CHECK (prefix IN ('A', 'D')),
  value integer NOT NULL DEFAULT 0 CHECK (value BETWEEN 0 AND 999),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (counter_date, prefix)
);

CREATE TABLE public.merchant_accounts (
  id text PRIMARY KEY,
  username_normalized varchar(64) NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  password_hash char(128) NOT NULL,
  password_salt char(32) NOT NULL,
  password_algorithm varchar(20) NOT NULL DEFAULT 'scrypt' CHECK (password_algorithm = 'scrypt'),
  password_version integer NOT NULL DEFAULT 1 CHECK (password_version > 0),
  enabled boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE public.merchant_sessions (
  id text PRIMARY KEY,
  merchant_id text NOT NULL REFERENCES public.merchant_accounts(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX merchant_sessions_merchant_id_idx ON public.merchant_sessions (merchant_id);
CREATE INDEX merchant_sessions_expires_at_idx ON public.merchant_sessions (expires_at);

COMMENT ON TABLE public.merchant_accounts IS '商家账号，仅保存加盐密码哈希，不保存明文密码';
COMMENT ON TABLE public.merchant_sessions IS '商家短期会话，仅保存随机令牌摘要';
COMMENT ON COLUMN public.orders.access_token_hash IS '顾客订单访问令牌的 SHA-256 摘要';
COMMENT ON COLUMN public.merchant_accounts.password_hash IS '使用 scrypt 派生的 64 字节十六进制摘要';
COMMENT ON COLUMN public.merchant_accounts.password_salt IS '每个账号独立生成的 16 字节随机盐';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.products, public.store_settings, public.payment_methods, public.orders, public.order_counters, public.merchant_accounts, public.merchant_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products, public.store_settings, public.payment_methods, public.orders, public.order_counters, public.merchant_accounts, public.merchant_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.ordering_create_order(
  p_order_id text, p_access_token_hash text, p_order_type text,
  p_customer_name text, p_phone text, p_delivery_area text,
  p_door_number text, p_pickup_day text, p_pickup_time text,
  p_delivery_time text, p_remark text, p_items jsonb
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_config public.store_settings%ROWTYPE;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_quantity integer;
  v_subtotal numeric(10, 2) := 0;
  v_delivery_fee numeric(10, 2) := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_prefix char(1);
  v_counter_date date;
  v_counter_id text;
  v_counter integer;
  v_short_code varchar(4);
BEGIN
  -- 事务内重新校验配送配置、商品价格和库存，客户端传入金额不可信。
  SELECT * INTO v_config FROM public.store_settings WHERE id = 'default';
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_SETTINGS_MISSING'; END IF;
  IF p_order_type NOT IN ('pickup', 'delivery') THEN RAISE EXCEPTION 'INVALID_ORDER_TYPE'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ORDER_ITEMS';
  END IF;
  IF p_order_type = 'delivery' AND (
    p_delivery_area = '' OR NOT (v_config.delivery_areas ? p_delivery_area)
    OR p_door_number = '' OR p_delivery_time = ''
  ) THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_ADDRESS';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := COALESCE((v_item->>'quantity')::integer, 0);
    IF v_quantity < 1 OR v_quantity > 99 THEN RAISE EXCEPTION 'INVALID_ITEM_QUANTITY'; END IF;
    SELECT * INTO v_product FROM public.products
      WHERE id = v_item->>'productId' AND available = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
    IF v_product.stock < v_quantity THEN RAISE EXCEPTION 'PRODUCT_STOCK_NOT_ENOUGH:%', v_product.name; END IF;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id, 'name', v_product.name, 'quantity', v_quantity,
      'unit', v_product.unit, 'price', v_product.price
    ));
    UPDATE public.products SET stock = stock - v_quantity, updated_at = now() WHERE id = v_product.id;
  END LOOP;

  IF p_order_type = 'delivery' AND v_subtotal < v_config.delivery_minimum THEN
    RAISE EXCEPTION 'DELIVERY_MINIMUM_NOT_MET';
  END IF;
  IF p_order_type = 'delivery' AND v_subtotal < v_config.free_delivery_threshold THEN
    v_delivery_fee := v_config.delivery_fee;
  END IF;

  -- 同一天的自提与配送订单分别维护 A/D 三位连续编号。
  v_prefix := CASE WHEN p_order_type = 'delivery' THEN 'D' ELSE 'A' END;
  v_counter_date := (current_timestamp AT TIME ZONE 'Asia/Shanghai')::date;
  v_counter_id := to_char(v_counter_date, 'YYYYMMDD') || '-' || v_prefix;
  INSERT INTO public.order_counters (id, counter_date, prefix, value, updated_at)
    VALUES (v_counter_id, v_counter_date, v_prefix, 1, now())
  ON CONFLICT (id) DO UPDATE SET
    value = CASE WHEN public.order_counters.value >= 999 THEN 1 ELSE public.order_counters.value + 1 END,
    updated_at = now()
  RETURNING value INTO v_counter;
  v_short_code := v_prefix || lpad(v_counter::text, 3, '0');

  INSERT INTO public.orders (
    id, short_code, access_token_hash, items, subtotal, delivery_fee, total,
    order_type, customer_name, phone, address, delivery_area, door_number,
    pickup_day, pickup_time, delivery_time, remark, status, delivery_status,
    payment_status, payment_reference, payment_method_id, created_at, updated_at
  ) VALUES (
    p_order_id, v_short_code, p_access_token_hash, v_order_items, v_subtotal,
    v_delivery_fee, v_subtotal + v_delivery_fee, p_order_type, p_customer_name, p_phone,
    CASE WHEN p_order_type = 'delivery' THEN trim(p_delivery_area || ' ' || p_door_number) ELSE '' END,
    CASE WHEN p_order_type = 'delivery' THEN p_delivery_area ELSE '' END,
    CASE WHEN p_order_type = 'delivery' THEN p_door_number ELSE '' END,
    p_pickup_day, CASE WHEN p_order_type = 'pickup' THEN p_pickup_time ELSE '' END,
    CASE WHEN p_order_type = 'delivery' THEN p_delivery_time ELSE '' END,
    p_remark, 'pending', 'waiting', 'pending', '', '', now(), now()
  );
  RETURN QUERY SELECT * FROM public.orders WHERE id = p_order_id;
END;
$function$;
COMMENT ON FUNCTION public.ordering_create_order(text, text, text, text, text, text, text, text, text, text, text, jsonb) IS '事务内校验商品、扣减库存、生成短订单号并创建订单';

CREATE OR REPLACE FUNCTION public.ordering_replace_payment_methods(p_methods jsonb)
RETURNS SETOF public.payment_methods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_method jsonb;
  v_ids text[] := ARRAY[]::text[];
  v_index integer := 0;
BEGIN
  IF jsonb_typeof(p_methods) IS DISTINCT FROM 'array' OR jsonb_array_length(p_methods) > 12 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHODS';
  END IF;
  -- 完整校验后再写入，任一异常都会回滚整个同步事务。
  FOR v_method IN SELECT value FROM jsonb_array_elements(p_methods)
  LOOP
    IF COALESCE(v_method->>'id', '') !~ '^[a-zA-Z0-9_-]{1,64}$'
      OR COALESCE(v_method->>'name', '') = ''
      OR COALESCE(v_method->>'payeeName', '') = ''
      OR COALESCE(v_method->>'qrCodeUrl', '') !~ '^https://' THEN
      RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
    END IF;
    v_ids := array_append(v_ids, v_method->>'id');
  END LOOP;
  FOR v_method IN SELECT value FROM jsonb_array_elements(p_methods)
  LOOP
    INSERT INTO public.payment_methods (id, name, payee_name, qr_code_url, note, enabled, sort_order, updated_at)
    VALUES (
      v_method->>'id', left(v_method->>'name', 40), left(v_method->>'payeeName', 40),
      left(v_method->>'qrCodeUrl', 2000), left(COALESCE(v_method->>'note', ''), 200),
      COALESCE((v_method->>'enabled')::boolean, true), v_index, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, payee_name = EXCLUDED.payee_name,
      qr_code_url = EXCLUDED.qr_code_url, note = EXCLUDED.note,
      enabled = EXCLUDED.enabled, sort_order = EXCLUDED.sort_order, updated_at = now();
    v_index := v_index + 1;
  END LOOP;
  DELETE FROM public.payment_methods WHERE NOT (id = ANY(v_ids));
  RETURN QUERY SELECT * FROM public.payment_methods ORDER BY sort_order ASC;
END;
$function$;
COMMENT ON FUNCTION public.ordering_replace_payment_methods(jsonb) IS '事务内覆盖同步全部商家收款码配置';

CREATE OR REPLACE FUNCTION public.ordering_change_merchant_password(
  p_merchant_id text, p_password_hash text, p_password_salt text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- 密码更新和全部旧会话撤销在同一事务完成。
  UPDATE public.merchant_accounts SET
    password_hash = p_password_hash, password_salt = p_password_salt,
    password_algorithm = 'scrypt', password_version = password_version + 1,
    must_change_password = false, updated_at = now()
  WHERE id = p_merchant_id AND enabled = true;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.merchant_sessions SET revoked_at = COALESCE(revoked_at, now())
    WHERE merchant_id = p_merchant_id AND revoked_at IS NULL;
  RETURN true;
END;
$function$;
COMMENT ON FUNCTION public.ordering_change_merchant_password(text, text, text) IS '原子更新商家密码哈希并撤销该账号全部旧会话';

REVOKE ALL ON FUNCTION public.ordering_create_order(text, text, text, text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ordering_replace_payment_methods(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ordering_change_merchant_password(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ordering_create_order(text, text, text, text, text, text, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ordering_replace_payment_methods(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ordering_change_merchant_password(text, text, text) TO service_role;

INSERT INTO public.products (id, name, description, price, unit, category, stock, badge, tone, available, sort_order) VALUES
  ('plain', '老面白馒头', '自然醒发，麦香柔软', 2.00, '个', '经典', 60, '招牌', 'wheat', true, 0),
  ('corn', '玉米面馒头', '细腻清甜，粗粮好味', 2.50, '个', '粗粮', 38, '人气', 'corn', true, 1),
  ('purple', '紫薯开花馒头', '真紫薯泥，松软微甜', 3.50, '个', '甜味', 24, '', 'purple', true, 2),
  ('brown-sugar', '红糖馒头', '古法红糖，温润回甘', 3.00, '个', '甜味', 30, '', 'brown', true, 3),
  ('jujube', '红枣馒头', '枣肉看得见，香甜不腻', 4.00, '个', '甜味', 18, '新品', 'jujube', true, 4),
  ('wholegrain', '全麦杂粮馒头', '麦麸谷物，饱腹扎实', 3.00, '个', '粗粮', 26, '', 'green', true, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_settings (
  id, brand_mark, brand_name, brand_tagline, hero_badge, hero_title,
  hero_description, hero_button_text, delivery_note, delivery_areas,
  delivery_range_km, delivery_minimum, delivery_fee, free_delivery_threshold
) VALUES (
  'default', '馒', '馒有意思', '每日现蒸 · 预约不等', '老面慢发酵 · 不加改良剂',
  E'每天现蒸，\n把柔软送到家',
  '清晨和面、自然醒发、按单现蒸。今晚预约，明早不排队，热乎乎的麦香刚刚好。',
  '看看今日馒头', '本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费',
  '["幸福小区", "阳光花园", "麦香公寓", "邻里写字楼"]'::jsonb, 3, 15, 3, 30
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_methods (id, name, payee_name, qr_code_url, note, enabled, sort_order) VALUES
  ('test-wechat', '微信测试收款码', '测试商家', 'https://placehold.co/480x480/F3E6C6/8C4F3D?text=TEST+QR+DO+NOT+PAY', '测试占位，请勿付款；请在商家端替换成真实个人收款码后再启用。', false, 0),
  ('test-alipay', '支付宝测试收款码', '测试商家', 'https://placehold.co/480x480/F3E6C6/8C4F3D?text=TEST+QR+DO+NOT+PAY', '测试占位，请勿付款；请在商家端替换成真实个人收款码后再启用。', false, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (
  id, short_code, access_token_hash, items, subtotal, delivery_fee, total,
  order_type, customer_name, phone, address, delivery_area, door_number,
  pickup_day, pickup_time, delivery_time, remark, status, delivery_status,
  payment_status, payment_reference, payment_method_id
) VALUES
  ('test-pickup-order', 'A001', repeat('1', 64),
   '[{"productId":"plain","name":"老面白馒头","quantity":4,"unit":"个","price":2},{"productId":"corn","name":"玉米面馒头","quantity":2,"unit":"个","price":2.5}]'::jsonb,
   13, 0, 13, 'pickup', '测试顾客（自提）', '13800000001', '', '', '',
   to_char((current_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD'), '08:20', '',
   '测试订单，请勿制作', 'pending', 'waiting', 'pending', '', ''),
  ('test-delivery-order', 'D001', repeat('2', 64),
   '[{"productId":"purple","name":"紫薯开花馒头","quantity":4,"unit":"个","price":3.5},{"productId":"wholegrain","name":"全麦杂粮馒头","quantity":3,"unit":"个","price":3}]'::jsonb,
   23, 3, 26, 'delivery', '测试顾客（配送）', '13800000002', '幸福小区 3幢502', '幸福小区', '3幢502',
   '', '', '09:00', '测试订单，请勿配送', 'preparing', 'waiting', 'submitted', 'TEST-NO-PAYMENT', 'test-wechat')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_counters (id, counter_date, prefix, value) VALUES
  (to_char((current_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'YYYYMMDD') || '-A', (current_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'A', 1),
  (to_char((current_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'YYYYMMDD') || '-D', (current_timestamp AT TIME ZONE 'Asia/Shanghai')::date, 'D', 1)
ON CONFLICT (id) DO NOTHING;

-- 回滚提示：本迁移包含真实业务表，不提供自动 DROP 回滚；如需回滚应先备份数据并人工确认。
