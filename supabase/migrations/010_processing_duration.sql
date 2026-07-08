-- เก็บเวลาที่ OpenAI ใช้สร้างรูปจริง (มิลลิวินาที) แยกจากเวลารอคิว
ALTER TABLE generations
  ADD COLUMN processing_duration_ms INT;
