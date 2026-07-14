-- กล่องตัวแปรกำหนดเองของ Art Style
-- เก็บเป็น array ของ { key, label } เช่น [{"key":"suite","label":"ชุดที่ต้องการ"}]
-- key ใช้ใน prompt template เป็น {{key}} และ label เป็นหัวข้อกล่องกรอกในหน้าสร้างรูป

ALTER TABLE art_styles
  ADD COLUMN variables JSONB NOT NULL DEFAULT '[]'::jsonb;
