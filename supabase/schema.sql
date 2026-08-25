create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  unit text not null default '个',
  category text not null default '经典',
  stock integer not null default 0 check (stock >= 0),
  badge text,
  image_url text,
  tone text not null default 'wheat',
  available boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key default 'default',
  brand_mark text not null default '馒',
  brand_name text not null default '馒有意思',
  brand_tagline text not null default '每日现蒸 · 预约不等',
  hero_badge text not null default '老面慢发酵 · 不加改良剂',
  hero_title text not null default E'每天现蒸，\n把柔软送到家',
  hero_description text not null default '清晨和面、自然醒发、按单现蒸。',
  hero_button_text text not null default '看看今日馒头',
  delivery_note text not null default '本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费',
  hero_background_image text not null default '',
  updated_at timestamptz not null default now()
);

-- 只迁移旧默认提示，不覆盖商家已经自定义的配送说明。
update public.store_settings
set delivery_note = '本店 3km 内配送 · 15元起送 · 配送费3元 · 满30元免配送费'
where delivery_note = '满 20 元可配送 · 配送费 3 元';

create table if not exists public.payment_methods (
  id text primary key,
  name text not null,
  payee_name text not null,
  qr_code_url text not null,
  note text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  short_code text unique,
  access_token text not null unique,
  created_at timestamptz not null default now(),
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  total numeric(10, 2) not null check (total >= 0),
  order_type text not null check (order_type in ('pickup', 'delivery')),
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  customer_name text not null,
  phone text not null,
  address text not null default '',
  delivery_area text not null default '',
  door_number text not null default '',
  pickup_day text not null,
  pickup_time text not null default '',
  delivery_time text not null default '',
  remark text not null default '',
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  delivery_status text not null default 'waiting' check (delivery_status in ('waiting', 'delivering', 'delivered')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'submitted', 'confirmed', 'rejected')),
  payment_reference text not null default '',
  payment_method_id text references public.payment_methods(id) on delete set null
);

-- 兼容已经创建过的数据库，补充自提/配送业务字段并迁移旧订单状态。
alter table public.orders add column if not exists short_code text;
alter table public.orders add column if not exists subtotal numeric(10, 2) not null default 0;
alter table public.orders add column if not exists delivery_fee numeric(10, 2) not null default 0;
alter table public.orders add column if not exists order_type text not null default 'pickup';
alter table public.orders add column if not exists delivery_area text not null default '';
alter table public.orders add column if not exists door_number text not null default '';
alter table public.orders add column if not exists delivery_time text not null default '';
alter table public.orders add column if not exists remark text not null default '';
alter table public.orders add column if not exists delivery_status text not null default 'waiting';
alter table public.orders add column if not exists payment_method_id text references public.payment_methods(id) on delete set null;

-- 先移除旧状态约束，再把历史 new/done/delivering 状态迁移到新结构。
alter table public.orders drop constraint if exists orders_status_check;

update public.orders
set order_type = fulfillment,
    delivery_fee = case when fulfillment = 'delivery' then 3 else 0 end,
    subtotal = greatest(total - case when fulfillment = 'delivery' then 3 else 0 end, 0),
    delivery_area = case when fulfillment = 'delivery' then delivery_area else '' end,
    door_number = case when fulfillment = 'delivery' and door_number = '' then address else door_number end,
    delivery_time = case when fulfillment = 'delivery' and delivery_time = '' then pickup_time else delivery_time end,
    remark = case when remark = '' then note else remark end,
    delivery_status = case
      when status = 'delivering' then 'delivering'
      when status = 'done' and fulfillment = 'delivery' then 'delivered'
      else delivery_status
    end,
    status = case
      when status = 'new' then 'pending'
      when status = 'delivering' then 'ready'
      when status = 'done' then 'completed'
      else status
    end;

alter table public.orders add constraint orders_status_check check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled'));
alter table public.orders drop constraint if exists orders_order_type_check;
alter table public.orders add constraint orders_order_type_check check (order_type in ('pickup', 'delivery'));
alter table public.orders drop constraint if exists orders_delivery_status_check;
alter table public.orders add constraint orders_delivery_status_check check (delivery_status in ('waiting', 'delivering', 'delivered'));

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create unique index if not exists orders_short_code_idx on public.orders(short_code) where short_code is not null;
create index if not exists payment_methods_sort_order_idx on public.payment_methods(sort_order asc);

alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop function if exists public.create_order(jsonb, text, text, text, text, text, text, text);

/** 根据数据库商品价格和库存创建完整订单，避免客户端篡改金额。 */
create or replace function public.create_order(
  p_items jsonb,
  p_order_type text,
  p_customer_name text,
  p_phone text,
  p_delivery_area text,
  p_door_number text,
  p_pickup_day text,
  p_pickup_time text,
  p_delivery_time text,
  p_remark text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_short_code text;
  v_access_token text;
  v_subtotal numeric(10, 2) := 0;
  v_delivery_fee numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity integer;
  v_attempt integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '订单商品不能为空';
  end if;
  if p_order_type not in ('pickup', 'delivery') then
    raise exception '取餐方式无效';
  end if;
  if p_order_type = 'pickup' and coalesce(trim(p_pickup_time), '') = '' then
    raise exception '请选择预计取餐时间';
  end if;
  if p_order_type = 'delivery' then
    if not (p_delivery_area = any(array['幸福小区', '阳光花园', '麦香公寓', '邻里写字楼']))
      or coalesce(trim(p_door_number), '') = ''
      or coalesce(trim(p_delivery_time), '') = '' then
      raise exception '配送地址不在本店 3km 可配送范围内';
    end if;
  end if;

  v_order_id := to_char(clock_timestamp(), 'MMDDHH24MISS') || lpad((floor(random() * 10000))::text, 4, '0');
  v_access_token := encode(gen_random_bytes(24), 'hex');

  -- 先锁定涉及的商品行并按数据库价格计算商品金额，防止并发超卖和价格篡改。
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product
    from products
    where id = v_item->>'product_id' and available = true
    for update;

    if not found or v_quantity <= 0 or v_quantity > v_product.stock then
      raise exception '商品不存在、已下架或库存不足';
    end if;
    v_subtotal := v_subtotal + v_product.price * v_quantity;
  end loop;

  -- 配送单执行 15 元起送、3 元配送费和满 30 元免配送费规则。
  if p_order_type = 'delivery' then
    if v_subtotal < 15 then
      raise exception '配送订单满 15 元起送';
    end if;
    v_delivery_fee := case when v_subtotal >= 30 then 0 else 3 end;
  end if;
  v_total := v_subtotal + v_delivery_fee;

  -- 生成 A/D 加三位数字的短号，并在写入前检查冲突。
  loop
    v_attempt := v_attempt + 1;
    v_short_code := case when p_order_type = 'delivery' then 'D' else 'A' end
      || lpad((floor(random() * 1000))::text, 3, '0');
    exit when not exists (select 1 from orders where short_code = v_short_code);
    if v_attempt >= 20 then
      raise exception '短订单号生成失败，请重新提交';
    end if;
  end loop;

  insert into orders (
    id, short_code, access_token, subtotal, delivery_fee, total, order_type, fulfillment,
    customer_name, phone, address, delivery_area, door_number, pickup_day, pickup_time,
    delivery_time, remark, note, status, delivery_status
  ) values (
    v_order_id, v_short_code, v_access_token, v_subtotal, v_delivery_fee, v_total, p_order_type, p_order_type,
    p_customer_name, p_phone,
    case when p_order_type = 'delivery' then trim(p_delivery_area) || ' ' || trim(p_door_number) else '' end,
    case when p_order_type = 'delivery' then trim(p_delivery_area) else '' end,
    case when p_order_type = 'delivery' then trim(p_door_number) else '' end,
    p_pickup_day,
    case when p_order_type = 'pickup' then p_pickup_time else '' end,
    case when p_order_type = 'delivery' then p_delivery_time else '' end,
    p_remark, p_remark, 'pending', 'waiting'
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from products where id = v_item->>'product_id';
    insert into order_items (order_id, product_id, product_name, quantity, unit, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.unit, v_product.price);
    update products set stock = stock - v_quantity, updated_at = now() where id = v_product.id;
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'shortCode', v_short_code,
    'accessToken', v_access_token,
    'createdAt', now(),
    'subtotal', v_subtotal,
    'deliveryFee', v_delivery_fee,
    'total', v_total,
    'status', 'pending',
    'deliveryStatus', 'waiting',
    'paymentStatus', 'pending'
  );
end;
$$;

revoke all on function public.create_order(jsonb, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, text, text, text, text, text, text, text, text, text) to service_role;

insert into public.store_settings (id) values ('default') on conflict (id) do nothing;

insert into public.products (id, name, description, price, unit, category, stock, badge, tone, sort_order)
values
  ('plain', '老面白馒头', '自然醒发，麦香柔软', 2, '个', '经典', 60, '招牌', 'wheat', 10),
  ('corn', '玉米面馒头', '细腻清甜，粗粮好味', 2.5, '个', '粗粮', 38, '人气', 'corn', 20),
  ('purple', '紫薯开花馒头', '真紫薯泥，松软微甜', 3.5, '个', '甜味', 24, null, 'purple', 30),
  ('brown-sugar', '红糖馒头', '古法红糖，温润回甘', 3, '个', '甜味', 30, null, 'brown', 40),
  ('jujube', '红枣馒头', '枣肉看得见，香甜不腻', 4, '个', '甜味', 18, '新品', 'jujube', 50),
  ('wholegrain', '全麦杂粮馒头', '麦麸谷物，饱腹扎实', 3, '个', '粗粮', 26, null, 'green', 60)
on conflict (id) do nothing;
