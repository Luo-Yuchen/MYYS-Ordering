-- 为点单系统增加四级账号角色和可配置后台会话时长。
-- 回滚提示：确认不再使用角色功能后，可删除 system_settings，并移除 merchant_accounts.role。

ALTER TABLE public.merchant_accounts
  ADD COLUMN role varchar(20) NOT NULL DEFAULT 'merchant';

-- 现有 admin 是系统初始管理账号，迁移后保留全部权限。
UPDATE public.merchant_accounts
SET role = 'super_admin', updated_at = now()
WHERE id = 'merchant-admin' OR username_normalized = 'admin';

ALTER TABLE public.merchant_accounts
  ADD CONSTRAINT merchant_accounts_role_check
  CHECK (role IN ('super_admin', 'admin', 'merchant', 'customer'));

CREATE INDEX merchant_accounts_role_idx ON public.merchant_accounts (role);

CREATE TABLE public.system_settings (
  id text PRIMARY KEY,
  merchant_session_duration_minutes integer NOT NULL DEFAULT 30
    CHECK (merchant_session_duration_minutes BETWEEN 5 AND 1440),
  updated_by text REFERENCES public.merchant_accounts(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.merchant_accounts.role IS '账号权限等级：超级管理员、普通管理员、商家或顾客';
COMMENT ON TABLE public.system_settings IS '仅由管理员通过 ordering-api 修改的系统级配置';
COMMENT ON COLUMN public.system_settings.merchant_session_duration_minutes IS '后台登录固定有效时长，单位分钟';

INSERT INTO public.system_settings (id, merchant_session_duration_minutes)
VALUES ('default', 30)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_settings TO service_role;
