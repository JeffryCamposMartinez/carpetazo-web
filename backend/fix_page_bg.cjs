const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const oldPage = `const Page = React.forwardRef(({ isLeft, children, pageNumber, isEmpty }, ref) => {
  return (
    <div 
      className="page relative h-full w-full overflow-hidden flex flex-col" 
      ref={ref}
      style={{ backgroundColor: '#151515' }} // Dark inner page color
    >
      {/* Spine shading depending on left or right page */}
      {isLeft ? (
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-black/90 to-transparent pointer-events-none z-20" />
      ) : (
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-black/90 to-transparent pointer-events-none z-20" />
      )}

      {/* Grid container for cards */}
      <div className={\`flex-1 grid gap-1.5 md:gap-3 h-full p-2 md:p-5 grid-cols-3 grid-rows-3 \${isLeft ? 'pr-8 md:pr-16' : 'pl-8 md:pl-16'}\`}>
        {children}
      </div>

      {pageNumber && (
        <div className={\`absolute bottom-2 text-slate-600 text-[10px] md:text-xs font-bold z-10 \${isLeft ? 'left-4' : 'right-4'}\`}>
          {pageNumber}
        </div>
      )}

      {/* If it's empty and it's the very first page or something, maybe a message? */}
      {isEmpty && (
         <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <span translate="no" className="material-symbols-outlined text-[8rem] md:text-[12rem]">style</span>
         </div>
      )}
    </div>
  );
});`;

const newPage = `const Page = React.forwardRef(({ isLeft, children, pageNumber, isEmpty }, ref) => {
  return (
    <div className="page" ref={ref}>
      <div className={\`relative h-full w-full overflow-hidden flex flex-col bg-[#151515] \${isLeft ? 'rounded-l-sm md:rounded-l-2xl shadow-[inset_0_0_10px_rgba(0,0,0,0.5),-5px_5px_15px_rgba(0,0,0,0.5)]' : 'rounded-r-sm md:rounded-r-2xl shadow-[inset_0_0_10px_rgba(0,0,0,0.5),5px_5px_15px_rgba(0,0,0,0.5)]'}\`}>
        {/* Paper Texture Overlay */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
        
        {/* Spine shading depending on left or right page */}
        {isLeft ? (
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-20" />
        ) : (
          <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-20" />
        )}

        {/* Grid container for cards */}
        <div className={\`flex-1 grid gap-1.5 md:gap-3 h-full p-2 md:p-5 grid-cols-3 grid-rows-3 \${isLeft ? 'pr-8 md:pr-12' : 'pl-8 md:pl-12'}\`}>
          {children}
        </div>

        {pageNumber && (
          <div className={\`absolute bottom-2 text-slate-600 text-[10px] md:text-xs font-bold z-10 \${isLeft ? 'left-4' : 'right-4'}\`}>
            {pageNumber}
          </div>
        )}

        {isEmpty && (
           <div className="absolute inset-0 flex flex-col items-center justify-center opacity-10 pointer-events-none">
              <span translate="no" className="material-symbols-outlined text-[8rem] md:text-[15rem]">style</span>
           </div>
        )}
      </div>
    </div>
  );
});`;

code = code.replace(oldPage, newPage);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Updated Page component layout");
