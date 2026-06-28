"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveSettings } from "./actions";
import type { PricingSettings } from "@/types/database";

interface SettingsPanelProps {
  settings: PricingSettings;
}

function toFormValues(settings: PricingSettings) {
  return {
    usd_to_thb: String(settings.usd_to_thb),
    price_text_input_per_1m: String(settings.price_text_input_per_1m),
    price_image_input_per_1m: String(settings.price_image_input_per_1m),
    price_image_output_per_1m: String(settings.price_image_output_per_1m),
  };
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(() => toFormValues(settings));

  useEffect(() => {
    setValues(toFormValues(settings));
  }, [settings]);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, value);
    }

    startTransition(async () => {
      try {
        await saveSettings(formData);
        toast.success("บันทึกการตั้งค่าสำเร็จ");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <div>
      <h1 className="page-title">ตั้งค่าระบบ</h1>

      <Alert className="mb-6">
        <AlertDescription>
          ตรวจสอบราคาล่าสุดจากหน้า OpenAI Pricing แล้วอัปเดตที่นี่
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSave} className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label>อัตรา USD → THB</Label>
          <Input
            name="usd_to_thb"
            type="number"
            step="0.01"
            value={values.usd_to_thb}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, usd_to_thb: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>ราคา Text Input ต่อ 1M tokens (USD)</Label>
          <Input
            name="price_text_input_per_1m"
            type="number"
            step="0.01"
            value={values.price_text_input_per_1m}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                price_text_input_per_1m: e.target.value,
              }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>ราคา Image Input ต่อ 1M tokens (USD)</Label>
          <Input
            name="price_image_input_per_1m"
            type="number"
            step="0.01"
            value={values.price_image_input_per_1m}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                price_image_input_per_1m: e.target.value,
              }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>ราคา Image Output ต่อ 1M tokens (USD)</Label>
          <Input
            name="price_image_output_per_1m"
            type="number"
            step="0.01"
            value={values.price_image_output_per_1m}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                price_image_output_per_1m: e.target.value,
              }))
            }
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          บันทึกการตั้งค่า
        </Button>
      </form>
    </div>
  );
}
