export type UserRole = "admin" | "user";
export type GenerationStatus = "pending" | "success" | "failed";
export type ShapeQuality = "low" | "medium" | "high";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  text_box_count: number;
  is_active: boolean;
  created_at: string;
}

export interface TextBoxConfig {
  id: string;
  product_id: string;
  position: number;
  label: string | null;
  placeholder: string | null;
  max_length: number | null;
}

export interface Pattern {
  id: string;
  product_id: string;
  name: string;
  requires_image: boolean;
  prompt_template: string;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Shape {
  id: string;
  name: string;
  width_px: number;
  height_px: number;
  quality: ShapeQuality;
  is_active: boolean;
  created_at: string;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  product_id: string | null;
  pattern_id: string | null;
  shape_id: string | null;
  input_text: Record<string, string>;
  uploaded_image_url: string | null;
  output_image_url: string | null;
  prompt_used: string | null;
  model: string;
  quality: string | null;
  size: string | null;
  input_text_tokens: number;
  input_image_tokens: number;
  output_image_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_thb: number;
  status: GenerationStatus;
  error_message: string | null;
  order_number: string | null;
  created_at: string;
}

export interface PricingSettings {
  usd_to_thb: number;
  price_text_input_per_1m: number;
  price_image_input_per_1m: number;
  price_image_output_per_1m: number;
}

export interface TokenUsage {
  input_text_tokens: number;
  input_image_tokens: number;
  output_image_tokens: number;
  total_tokens: number;
}

export interface GenerationResult {
  generationId: string;
  outputImageUrl: string;
  outputFileName: string;
  orderNumber: string;
  usage: TokenUsage;
  costUsd: number;
  costThb: number;
  costThbDisplay: string;
  promptUsed: string;
}

type TableDef<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      products: TableDef<Product>;
      text_box_configs: TableDef<TextBoxConfig>;
      patterns: TableDef<Pattern>;
      shapes: TableDef<Shape>;
      prompts: TableDef<Prompt>;
      app_settings: TableDef<AppSetting>;
      generations: TableDef<Generation>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
