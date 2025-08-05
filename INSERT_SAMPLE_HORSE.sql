-- Insert sample horse data into the horses table
-- Run this in your Supabase SQL Editor to add a test horse

INSERT INTO horses (
  id,
  user_id,
  name,
  gender,
  birth_date,
  breed,
  height,
  weight,
  image_url,
  created_at,
  updated_at
) VALUES (
  'a7b8c9d0-e1f2-4a5b-8c9d-0e1f2a3b4c5d',
  'efab7495-b514-4c6d-9c83-f17c3afdf3ae', -- Use the actual user UUID
  'Thunder',
  'Stallion',
  '2018-03-15'::date,
  'Arabian',
  152, -- Height in cm (over 100 as integer)
  1100,
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800', -- Sample horse image
  NOW(),
  NOW()
);

-- Alternative version if you want to specify a particular user_id:
-- Replace 'YOUR_USER_ID_HERE' with the actual user UUID you want to assign this horse to
/*
INSERT INTO horses (
  id,
  user_id,
  name,
  gender,
  birth_date,
  breed,
  height,
  weight,
  image_url,
  created_at,
  updated_at
) VALUES (
  'a7b8c9d0-e1f2-4a5b-8c9d-0e1f2a3b4c5d',
  'YOUR_USER_ID_HERE',
  'Thunder',
  'Stallion',
  '2018-03-15'::date,
  'Arabian',
  152,
  1100,
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800',
  NOW(),
  NOW()
);
*/

-- Verify the insert was successful
SELECT * FROM horses WHERE id = 'a7b8c9d0-e1f2-4a5b-8c9d-0e1f2a3b4c5d';
