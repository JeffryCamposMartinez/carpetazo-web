const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// 1. Add useEffect to close preview on page change
if (!code.includes("useEffect(() => {\n    setPreviewCard(null);\n  }, [currentPage]);")) {
  code = code.replace(
    "useEffect(() => {\n    const handleKeyDown = (e) => {",
    "useEffect(() => {\n    setPreviewCard(null);\n  }, [currentPage]);\n\n  useEffect(() => {\n    const handleKeyDown = (e) => {"
  );
}

// 2. Modify root onClick to also clear previewCard
code = code.replace(
  "onClick={() => setActiveCardId(null)}",
  "onClick={() => { setActiveCardId(null); setPreviewCard(null); }}"
);

// 3. Update the styling of the IN-ALBUM SPREAD PREVIEW
// Target 1: The main wrapper style
const targetWrapperStyle = `style={{
                  top: isDesktop ? '-20px' : '-8px',
                  bottom: isDesktop ? '-20px' : '-8px',
                  right: isDesktop ? '-28px' : '-10px',
                  left: isDesktop ? 'calc(-100% - 28px)' : '-10px',
                  backgroundColor: '#151515',
                  transform: 'translateZ(100px)'
                }}`;
const replaceWrapperStyle = `style={{
                  top: isDesktop ? '-20px' : '-8px',
                  bottom: isDesktop ? '-20px' : '-8px',
                  right: isDesktop ? '-28px' : '-10px',
                  left: isDesktop ? 'calc(-100% - 28px)' : '-10px',
                  transform: 'translateZ(100px)'
                }}`;
code = code.replace(targetWrapperStyle, replaceWrapperStyle);

// Target 2: The main wrapper class
const targetWrapperClass = `className="absolute rounded-2xl md:rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.95)] z-[1000] flex flex-col md:flex-row overflow-hidden border border-white/10"`;
const replaceWrapperClass = `className="absolute rounded-2xl md:rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.95)] z-[1000] flex flex-col md:flex-row overflow-hidden border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md"`;
code = code.replace(targetWrapperClass, replaceWrapperClass);

// Target 3: The left side panel bg
const targetLeftBg = `className="w-full md:w-1/2 h-[45%] md:h-full bg-black/40 flex items-center justify-center p-4 md:p-8 relative"`;
const replaceLeftBg = `className="w-full md:w-1/2 h-[45%] md:h-full bg-black/20 flex items-center justify-center p-4 md:p-8 relative"`;
code = code.replace(targetLeftBg, replaceLeftBg);

// Target 4: The right side panel bg
const targetRightBg = `className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between p-4 md:p-8 text-white relative bg-[#151515]"`;
const replaceRightBg = `className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between p-4 md:p-8 text-white relative bg-transparent"`;
code = code.replace(targetRightBg, replaceRightBg);


fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Applied translucency and click-outside/page-change close logic");
