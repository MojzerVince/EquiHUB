-- Insert sample horse data into the horses table
-- Run this in your Supabase SQL Editor to add a test horse

INSERT INTO horses (
  id,
  user_id,
  name,
  gender,
  year_of_birth,
  breed,
  height,
  weight,
  description,
  image_url,
  created_at,
  updated_at
) VALUES (
  'efab7495-b514-4c6d-9c83-f17c3afdf3ae',
  (SELECT id FROM auth.users LIMIT 1), -- Uses the first available user ID
  'Thunder',
  'Stallion',
  2018,
  'Arabian',
  15.2,
  1100,
  'A magnificent Arabian stallion with a spirited personality and excellent jumping abilities. Thunder has won several regional competitions and is known for his intelligence and strong bond with riders.',
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
  year_of_birth,
  breed,
  height,
  weight,
  description,
  image_url,
  created_at,
  updated_at
) VALUES (
  'efab7495-b514-4c6d-9c83-f17c3afdf3ae',
  'YOUR_USER_ID_HERE',
  'Thunder',
  'Stallion',
  2018,
  'Arabian',
  15.2,
  1100,
  'A magnificent Arabian stallion with a spirited personality and excellent jumping abilities. Thunder has won several regional competitions and is known for his intelligence and strong bond with riders.',
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800',
  NOW(),
  NOW()
);
*/

-- Verify the insert was successful
SELECT * FROM horses WHERE id = 'efab7495-b514-4c6d-9c83-f17c3afdf3ae';
