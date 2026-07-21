
CREATE POLICY "disb read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'disbursement-evidence');
CREATE POLICY "disb insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'disbursement-evidence' AND owner = auth.uid());
CREATE POLICY "disb delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'disbursement-evidence' AND owner = auth.uid());
