# 店家 Markdown

每間店在 `shops/<穩定ID>.md`，`catalog.json` 保存收錄順序與涵蓋範圍。

檔案上方兩條 `---` 之間是 JSON 格式的資料欄位（YAML 相容子集），下方是介紹。`introType: "long"` 表示150–300字介紹；`summary` 表示早期資料的短摘要，內文須與description一致。既有ID不要更動，才能保留使用者收藏。

資料欄位包含分類、地址、經緯度、來源與查核日期、週時段與例外日期。星期0代表星期日；`hours: null` 是未知，空陣列代表確認休息；跨午夜用如22:00–02:00。未知價格使用null，不自行推估。

修改Markdown後執行 `npm run build` 產生JSON，再 `npm test` 驗證。不要直接編輯產生的shops.json，它會在下次建置時更新。

新內容與修正先在擁有者的本機待審，核准後才進入main；main更新會觸發GitHub Pages發布。Markdown目前只處理純文字介紹，不渲染外部HTML。
