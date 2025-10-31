-- Update system_settings table to support company logo storage
-- Run this in Supabase SQL Editor

-- First, check if company_logo exists and update it
UPDATE public.system_settings 
SET value = jsonb_build_object(
  'type', 'text',
  'imagePath', null,
  'fallbackText', 'PM',
  'imageAlt', 'Logo công ty'
)
WHERE key = 'company_logo';

-- If company_logo doesn't exist, insert it
INSERT INTO public.system_settings (key, value, description) 
VALUES ('company_logo', jsonb_build_object(
  'type', 'text',
  'imagePath', null,
  'fallbackText', 'PM',
  'imageAlt', 'Logo công ty'
), 'Company logo configuration')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add company_name and company_subtitle settings
INSERT INTO public.system_settings (key, value, description) VALUES
('company_name', '"QLDA"', 'Company name display'),
('company_subtitle', '"Quản lý dự án"', 'Company subtitle display'),
('company_description', '"Quản lý công việc các dự án"', 'Company description')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create storage bucket for company assets (if not exists)
-- Run this separately in Supabase Dashboard > Storage
-- Bucket name: company-assets
-- Public: true
-- File size limit: 2MB
-- Allowed mime types: image/*

-- RLS Policies for system_settings (already exist, but verify):
-- All users can view
-- Only managers can update
