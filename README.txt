車輛維修保養與油耗管理中心 V5.6.7－GitHub資料保留部署版

【V5.6.7 A4直式PDF方向修正】
- 修正「PDF頁面是直式，但報表內容整頁橫倒90度」問題。
- 根因：舊版 reportCss 預設 landscape，維修廠查看清單又額外指定 landscape；列印視窗若以直向另存，部分瀏覽器會將橫式內容旋轉塞入直式頁面。
- 所有 PDF 報表統一固定為真正 A4 直式 210×297mm，不再接受 landscape 方向覆寫。
- 維修廠查看清單、全部車輛總覽、目前車輛完整報告、完整資料列印存檔全部走同一個直式列印路徑。
- 寬表格與維修廠清單重新調整字級、換行、padding，避免改直式後發生欄位裁切。
- PDF內容根節點強制 transform:none／rotate:none，防止整頁內容被旋轉。
- 實際PDF渲染驗收：A4 595.276×841.89pt、Page rotation 0°；7欄維修廠表與10欄寬表均可在直式頁面內完整顯示。
- GitHub Actions 新增 PDF portrait-layout regression。

【V5.6.6 iPhone／iPad全輸入框修正】
- 不只登入頁：所有新增／編輯彈出視窗在iPhone／iPad都不再程式自動focus，避免iOS出現「欄位已focus但鍵盤不彈出」。
- 登入帳號／密碼的touchend備援擴充到iPhone與iPad。
- 觸控裝置所有可寫input／select／textarea統一16px、pointer可用、文字可選與足夠觸控高度。
- 靜態與動態number欄都加入inputmode=decimal。
- 觸控驗收：iPhone 390×844、iPad直向820×1180、iPad橫向1180×820，三組各47／47通過。
- GitHub Actions新增 iPhone/iPad all-input guard regression。

【V5.6.6 iPad登入鍵盤修正】
- 移除登入頁載入時對帳號欄的程式自動focus，避免iPad Safari／主畫面PWA出現「欄位已聚焦但螢幕鍵盤沒彈出」的狀態。
- 帳號與密碼欄在每次觸控時都重新確認 disabled=false、readOnly=false、pointer-events可用。
- iPad觸控 touchend 會在使用者手勢內補做focus，符合iOS軟體鍵盤必須由使用者操作觸發的限制。
- 增加「啟用帳號輸入」與「啟用密碼輸入」兩個獨立備援按鈕；若Safari偶發卡住，可直接按對應按鈕重新喚起鍵盤。
- 登入輸入框維持17px字體並加入autocapitalize/autocorrect/spellcheck/enterkeyhint設定，降低iPad輸入干擾。
- GitHub Actions新增 iPad login keyboard regression，避免未來版本又把自動focus問題帶回來。

【V5.6.6 VOLVO 6萬公里保養紀錄】
- 新增2026/08/10、63,343 km、工單WV2608011100。
- 實付33,453元：工資8,815元、零件24,638元。
- 變速箱油、煞車油、燃油濾清器、引擎空氣濾芯、四輪平衡及右上扭力臂已列入。
- 電瓶SOH100%／SOC77%、輪胎前5.2mm後4.8mm、來令片前8mm後6mm列入檢查基準。
- 蒸發器滲漏列為待修注意，本次未更換。
- 下次定保提醒：2027/07/21。
- 三張原始單據已合併為PDF並保留原始JPG附件。

此版本保留VOLVO XC60與LEXUS ES300的結構化加油、維修、稅費、提醒及評估資料。
LEXUS車牌已遮蔽為72**-GE。
本完整資料版保留原始維修單照片、PDF、Numbers附件及附件連結，方便正式使用與查閱。

重要：本包包含車牌、里程、費用、日期、維修廠與原始附件。前端登入頁不能保護GitHub Pages上的靜態檔案；請勿將此完整資料版放在可被外部直接存取的公開Pages環境。長期正式使用應把私人資料與附件移到受權限控管的Google後端。

【GitHub Pages 上傳步驟】
1. 解壓縮本資料夾。
2. 在 GitHub 建立新的 Repository。
3. 將本資料夾內所有檔案與資料夾上傳到 Repository 根目錄，包含 .github 資料夾。
4. Repository 的預設分支請使用 main。
5. 到 Settings → Pages，將 Source 設為 GitHub Actions。
6. 到 Actions 查看「Deploy Vehicle Hub to GitHub Pages」是否全部通過。
7. 部署完成後，由 Settings → Pages 開啟網站網址。

【公開範圍提醒】
- LEXUS 車牌已遮蔽為 72**-GE。
- 原始維修單附件與附件連結均保留於 attachments/。
- VOLVO 車牌、里程、加油、維修金額、維修廠與日期仍保留在程式資料內。
- 不論Repository本身如何設定，都不要只靠前端登入頁保護靜態私人資料；請確認Pages實際存取範圍，或將私人資料改放Google Sheets／Drive後端。


【V5.6.6 登入提示隱藏與Google Sheets同步】
- 登入帳號與密碼已設定；系統畫面不顯示帳密提示。
- 本機登入是操作入口，不等同伺服器安全驗證。公開GitHub版本要保護資料，必須使用Google Sheets＋Apps Script後端，且前端不可內建私人資料。
- 已附Google_Sheets_Apps_Script資料夾，依部署說明建立雲端資料庫。
- 兩個家庭帳號共用同一個 family 工作區，可在不同裝置讀寫同一份資料。


【V5.6.6 LEXUS資料不足專項修正】
- 舊iPhone／iPad即使已經標記v56 migration完成，只要既有21筆LEXUS正式紀錄的fullTank狀態不一致，載入時仍會重新校正為人工確認加滿，不再只相信migration旗標。
- 2025/11/26缺里程的44.64L會併入2025/12/11完整週期；2026/03/08、03/31、06/18缺里程紀錄會一起併入2026/07/27完整週期。
- LEXUS全歷史目前可形成16個有效油耗週期；最近有效油耗約8.01 km/L，近3有效週期燃油成本約3.93元/km。
- 「新增加油紀錄」完整表單與快速加油都改成預設「加滿＝是」；只有偶發部分加油時才手動改成「否／部分加油」。

【V5.6.6 最終修正】
- LEXUS既有21筆加油均確認加滿；缺里程的加滿紀錄不再切斷週期，會累積至下一筆有里程的加滿後結算。
- VOLVO 2026/07/21 25.56L／800元固定為部分加油，不產生20.19 km/L假油耗。
- Google雲端分離remoteRevision與localBaseRevision；登入不會把舊裝置誤認為已同步，上傳前會先查雲端revision。
- 到期當天顯示「今天到期」，不再顯示「逾期0天」。
- 輪胎／電瓶實際更換日優先作為後續檢查基準。
- 全域搜尋支援工單號、日期、里程、維修廠、金額、項目、明細與備註。
- iPad登入取消載入時自動focus，並提供帳號／密碼兩個獨立鍵盤備援。

V5.6.8 新增 2026/10/15 LEXUS 維修單、里程差異覆核警示（詳見 V5.6.8_維修工單與里程修正說明.txt）。
