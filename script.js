// (CONFIG や グローバル変数は変更なし)
const CONFIG = {
    REF_WIDTH: 514.6, REF_HEIGHT: 363.9, BOX_WIDTH_PX: 33.7,
    BOX_HEIGHT_PX: 51.8, GAP_A_PX: 7.4, GAP_B_PX: 8.9, GAP_V_PX: 7.9,
    MARGIN_LEFT_PX: 11.0, MARGIN_TOP_PX: 36.5, PADDING_PX: 1.0,
    COLS: 12, ROWS: 5, MAX_PAGES: 60, DEFAULT_START_TAMPAGE: 2,
    DEFAULT_END_TAMPAGE: 60, DEFAULT_START_MIHIRAKI: 1, DEFAULT_END_MIHIRAKI: 60
};
let isImageLoaded = false, imageCanvas, ctx, uploadedImageWidth, uploadedImageHeight;
let coordMapRatio = [], orderMapTampage = [], orderMapMihiraki = [];

// ★ 'defer' により、この時点でDOMは利用可能です
const imageLoader = document.getElementById('imageLoader');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const statusEl = document.getElementById('status');
const pdfNameTampage = document.getElementById('pdfNameTampage');
const startPageTampage = document.getElementById('startPageTampage');
const endPageTampage = document.getElementById('endPageTampage');
const btnTampage = document.getElementById('btnTampage');
const pdfNameMihiraki = document.getElementById('pdfNameMihiraki');
const startPageMihiraki = document.getElementById('startPageMihiraki');
const endPageMihiraki = document.getElementById('endPageMihiraki');
const btnMihiraki = document.getElementById('btnMihiraki');
imageCanvas = document.getElementById('imageCanvas');

// ★ 安全のため、DOM取得失敗時のガードを追加
if (!imageLoader || !btnTampage || !btnMihiraki || !imageCanvas || !statusEl || !pdfNameTampage || !startPageTampage || !endPageTampage || !pdfNameMihiraki || !startPageMihiraki || !endPageMihiraki) {
    console.error('必要なDOM要素の取得に失敗しました。HTMLのIDが正しいか確認してください。');
    if (statusEl) { // statusEl自体がnullでないか確認
        statusEl.textContent = 'アプリの初期化に失敗しました。ページを再読み込みしてください。';
        statusEl.className = 'error';
    }
} else {
    // --- 正常系の処理を 'else' ブロックで囲む ---
    ctx = imageCanvas.getContext('2d');
    generateCoordMapRatio();
    generateOrderMaps();
    
    imageLoader.addEventListener('change', (e) => {
        // (中略 ... 画像読み込み)
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                imageCanvas.width = img.width; imageCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                imagePreview.src = event.target.result;
                imagePreviewContainer.style.display = 'block';
                isImageLoaded = true; uploadedImageWidth = img.width; uploadedImageHeight = img.height;
                btnTampage.disabled = false;
                btnMihiraki.disabled = false;
                setStatus('画像の準備が完了しました。モードを選択してください。', 'success');
            };
            img.onerror = () => { setStatus('画像ファイルの読み込みに失敗しました。', 'error'); isImageLoaded = false; };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    btnTampage.addEventListener('click', () => { if (!isImageLoaded) return; processPDF('Tampage'); });
    btnMihiraki.addEventListener('click', () => { if (!isImageLoaded) return; processPDF('Mihiraki'); });
}

function setStatus(message, type = '') { 
    if (statusEl) {
        statusEl.textContent = message; 
        statusEl.className = type; 
    }
}


// 3. メイン処理 (PDF生成)
// =============================================================

async function processPDF(mode) {
    try {
        // (jsPDFCtor のロジック ... 変更なし)
        const jsPDFCtor =
          (window.jspdf && (window.jspdf.jsPDF || window.jspdf.default)) // v2 UMD
          || window.jsPDF;                                                // v1 Global
        
        if (!jsPDFCtor) {
          throw new Error('jsPDF が読み込まれていません。jspdf.umd.min.js を先に読み込んでください。');
        }
        
        setStatus(`[${mode}] PDFを生成中です... (1/3)`, 'processing');
        
        const inputs = getValidatedInputs(mode);
        if (!inputs) return; 

        btnTampage.disabled = true;
        btnMihiraki.disabled = true;
        
        const orientation = (mode === 'Mihiraki') ? 'landscape' : 'portrait';
        
        // (new jsPDFCtor を使用 ... 変更なし)
        const pdf = new jsPDFCtor({ orientation: orientation, unit: 'pt', format: 'a4' });

        const a4Width = pdf.internal.pageSize.getWidth();
        const a4Height = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const maxWidth = a4Width - (margin * 2);
        const maxHeight = a4Height - (margin * 2);

        // (処理対象ページのリスト作成 ... 変更なし)
        setStatus(`[${mode}] 処理対象ページを計算中... (2/3)`, 'processing');
        const pagesToProcess = [];
        // (中略 ... pagesToProcess の作成)
        if (mode === 'Tampage') {
            for (let i = inputs.start; i <= inputs.end; i++) { pagesToProcess.push(i); }
        } else {
            const targetPairs = [];
            for (let i = inputs.start; i <= inputs.end; i += 2) { targetPairs.push([i, i + 1]); }
            orderMapMihiraki.forEach(pair => {
                const found = targetPairs.find(p => p[0] === pair[0]);
                if (found) { pagesToProcess.push(pair); }
            });
        }
        if (pagesToProcess.length === 0) {
            setStatus('処理対象のページがありません。範囲指定を確認してください。', 'error');
            btnTampage.disabled = false;
            btnMihiraki.disabled = false;
            return;
        }

        // (ページごとに切り抜き & PDFに追加 ... 変更なし)
        setStatus(`[${mode}] 全 ${pagesToProcess.length} ページを生成中... (3/3)`, 'processing');
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        for (let i = 0; i < pagesToProcess.length; i++) {
            const pageData = pagesToProcess[i];
            const slice = (mode === 'Tampage') ? getSliceData('Tampage', pageData) : getSliceData('Mihiraki', pageData[0]);
            if (slice.widthPx <= 0 || slice.heightPx <= 0) continue;
            cropCanvas.width = slice.widthPx;
            cropCanvas.height = slice.heightPx;
            cropCtx.drawImage(
                imageCanvas,
                slice.xPx, slice.yPx, slice.widthPx, slice.heightPx,
                0, 0, slice.widthPx, slice.heightPx
            );
            
            // ★★★ iPad黒塗りバグ修正 1: 'image/png' に変更 ★★★
            const imgData = cropCanvas.toDataURL('image/png');
            
            if (i > 0) { pdf.addPage('a4', orientation); }
            const imgRatio = slice.widthPx / slice.heightPx;
            let newWidth, newHeight;
            if ( (maxWidth / maxHeight) > imgRatio ) {
                newHeight = maxHeight; newWidth = maxHeight * imgRatio;
            } else {
                newWidth = maxWidth; newHeight = maxWidth / imgRatio;
            }
            const offsetX = (a4Width - newWidth) / 2;
            const offsetY = (a4Height - newHeight) / 2;
            
            // ★★★ iPad黒塗りバグ修正 2: 'PNG' に変更 ★★★
            pdf.addImage(imgData, 'PNG', offsetX, offsetY, newWidth, newHeight);
            
            if (i % 10 === 0 && i > 0) {
                setStatus(`[${mode}] ${i} / ${pagesToProcess.length} ページ処理中...`, 'processing');
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        pdf.save(inputs.filename);
        setStatus(`完了: ${inputs.filename} がダウンロードされました。`, 'success');
    } catch (error) {
        console.error('PDF生成中にエラーが発生しました:', error);
        setStatus(`エラー: ${error.message}。開発者コンソールを確認してください。`, 'error');
    } finally {
        btnTampage.disabled = false;
        btnMihiraki.disabled = false;
    }
}

// (ヘルパー関数 ... 変更なし)
// (getValidatedInputs, generateCoordMapRatio, generateOrderMaps)
// (中略)
function getValidatedInputs(mode) {
    let filename, start, end, startInput, endInput, defaultStart, defaultEnd;
    if (mode === 'Tampage') {
        filename = pdfNameTampage.value.trim();
        startInput = startPageTampage.value; endInput = endPageTampage.value;
        defaultStart = CONFIG.DEFAULT_START_TAMPAGE; defaultEnd = CONFIG.DEFAULT_END_TAMPAGE;
    } else {
        filename = pdfNameMihiraki.value.trim();
        startInput = startPageMihiraki.value; endInput = endPageMihiraki.value;
        defaultStart = CONFIG.DEFAULT_START_MIHIRAKI; defaultEnd = CONFIG.DEFAULT_END_MIHIRAKI;
    }
    if (!filename) { filename = (mode === 'Tampage') ? '単ページ' : '見開き'; }
    if (!filename.toLowerCase().endsWith('.pdf')) { filename += '.pdf'; }
    start = parseInt(startInput) || defaultStart;
    end = parseInt(endInput) || defaultEnd;
    if (mode === 'Mihiraki') {
        if (start % 2 === 0) start -= 1;
        if (end % 2 !== 0) end += 1;
    }
    start = Math.max(1, Math.min(start, CONFIG.MAX_PAGES));
    end = Math.max(1, Math.min(end, CONFIG.MAX_PAGES));
    if (end < start) {
        setStatus('エラー: 終了ページが開始ページより前です。', 'error');
        return null;
    }
    return { filename, start, end };
}
function generateCoordMapRatio() {
    coordMapRatio = [];
    const w = CONFIG.BOX_WIDTH_PX / CONFIG.REF_WIDTH;
    const gapA = CONFIG.GAP_A_PX / CONFIG.REF_WIDTH;
    const gapB = CONFIG.GAP_B_PX / CONFIG.REF_WIDTH;
    const marginLeft = CONFIG.MARGIN_LEFT_PX / CONFIG.REF_WIDTH;
    const h = CONFIG.BOX_HEIGHT_PX / CONFIG.REF_HEIGHT;
    const gapV = CONFIG.GAP_V_PX / CONFIG.REF_HEIGHT;
    const marginTop = CONFIG.MARGIN_TOP_PX / CONFIG.REF_HEIGHT;
    let currentX_Ratio = marginLeft;
    for (let c = 0; c < CONFIG.COLS; c++) {
        coordMapRatio[c] = [];
        let currentY_Ratio = marginTop;
        for (let r = 0; r < CONFIG.ROWS; r++) {
            coordMapRatio[c][r] = { xRatio: currentX_Ratio, yRatio: currentY_Ratio };
            currentY_Ratio += h + gapV;
        }
        const gapToAdd_Ratio = (c % 2 === 0) ? gapA : gapB;
        currentX_Ratio += w + gapToAdd_Ratio;
    }
}
function generateOrderMaps() {
    orderMapTampage = [null];
    let id = 1;
    for (let colPair = 0; colPair < CONFIG.COLS / 2; colPair++) {
        const colRight = CONFIG.COLS - 1 - (colPair * 2);
        const colLeft = colRight - 1;
        for (let r = 0; r < CONFIG.ROWS; r++) {
            orderMapTampage[id++] = [colRight, r];
            orderMapTampage[id++] = [colLeft, r];
        }
    }
    orderMapMihiraki = [];
    let pairId = 0;
    for (let colPair = 0; colPair < CONFIG.COLS / 2; colPair++) {
        for (let r = 0; r < CONFIG.ROWS; r++) {
            const idRight = (colPair * CONFIG.ROWS + r) * 2 + 1;
            const idLeft = idRight + 1;
            orderMapMihiraki[pairId++] = [idRight, idLeft];
        }
    }
}
function getColRowFromTampageID(id) {
    if (id < 1 || id > CONFIG.MAX_PAGES || !orderMapTampage[id]) { throw new Error(`無効なページID ${id}`); }
    return orderMapTampage[id];
}

// ★★★ ここを修正しました ★★★
function getCoordsRatio(col, row) {
    if (!coordMapRatio[col] || !coordMapRatio[col][row]) { throw new Error(`無効な座標 [${col}, ${row}]`); }
    return coordMapRatio[col][row]; // 'coordMapTampage' -> 'coordMapRatio' に修正
}

function getSliceData(mode, id) {
    const imgW = uploadedImageWidth;
    const imgH = uploadedImageHeight;
    const paddingXPx = (CONFIG.PADDING_PX / CONFIG.REF_WIDTH) * imgW;
    const paddingYPx = (CONFIG.PADDING_PX / CONFIG.REF_HEIGHT) * imgH;
    let origX, origY, origW, origH;
    const wPx = (CONFIG.BOX_WIDTH_PX / CONFIG.REF_WIDTH) * imgW;
    const hPx = (CONFIG.BOX_HEIGHT_PX / CONFIG.REF_HEIGHT) * imgH;
    if (mode === 'Tampage') {
        const [col, row] = getColRowFromTampageID(id);
        const { xRatio, yRatio } = getCoordsRatio(col, row);
        origX = xRatio * imgW; origY = yRatio * imgH;
        origW = wPx; origH = hPx;
    } else {
        const idLeft = id + 1;
        const [colLeft, rowLeft] = getColRowFromTampageID(idLeft);
        const { xRatio: xRatioLeft, yRatio } = getCoordsRatio(colLeft, rowLeft);
        const gapAPx = (CONFIG.GAP_A_PX / CONFIG.REF_WIDTH) * imgW;
        origX = xRatioLeft * imgW; origY = yRatio * imgH;
        origW = (wPx * 2) + gapAPx; origH = hPx;
    }
    const finalX = Math.max(0, origX - paddingXPx);
    const finalY = Math.max(0, origY - paddingYPx);
    const finalW = Math.min(imgW - finalX, origW + (paddingXPx * 2));
    const finalH = Math.min(imgH - finalY, origH + (paddingYPx * 2));
    return { xPx: finalX, yPx: finalY, widthPx: finalW, heightPx: finalH };
}