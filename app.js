(() => {
  const $ = id => document.getElementById(id);
  const msg = (text, cls='') => { const e=$('status'); if(e){e.className='status '+cls;e.textContent=text;} };
  const safeName = f => (f.name||'document').replace(/\.pdf$/i,'').replace(/[^a-z0-9_-]+/gi,'-').slice(0,60)||'document';
  function save(blob, filename) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  async function getPdf(file) {
    if(!file) throw new Error('Please select a PDF file first.');
    if(!window.PDFLib) throw new Error('PDF library did not load. Check your internet connection and reload.');
    return PDFLib.PDFDocument.load(await file.arrayBuffer());
  }
  async function run(buttonId, fn) {
    const b=$(buttonId); if(!b) return;
    b.disabled=true; msg('Working…');
    try { await fn(); } catch(e) { console.error(e); msg(e.message||'Something went wrong. Try again.','err'); }
    finally { b.disabled=false; }
  }
  const kind=document.body.dataset.tool;
  if(kind==='merge') $('mergeBtn').onclick=()=>run('mergeBtn',async()=>{
    const files=[...$('mergeFiles').files]; if(files.length<2) throw new Error('Choose at least two PDF files.');
    const out=await PDFLib.PDFDocument.create();
    for(const file of files){const src=await getPdf(file);const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p));}
    save(new Blob([await out.save()],{type:'application/pdf'}),'paperkit-merged.pdf');msg('Merged PDF downloaded.','ok');
  });
  if(kind==='split') $('splitBtn').onclick=()=>run('splitBtn',async()=>{
    const file=$('splitFile').files[0],src=await getPdf(file);if(src.getPageCount()>250)throw new Error('For mobile safety, split files with 250 pages or fewer.');
    if(!window.JSZip)throw new Error('ZIP library did not load. Check your internet connection and reload.');
    const zip=new JSZip();
    for(let i=0;i<src.getPageCount();i++){const out=await PDFLib.PDFDocument.create(),[page]=await out.copyPages(src,[i]);out.addPage(page);zip.file(safeName(file)+'-page-'+String(i+1).padStart(3,'0')+'.pdf',await out.save());}
    save(await zip.generateAsync({type:'blob'}),safeName(file)+'-split-pages.zip');msg('Created '+src.getPageCount()+' page PDFs in a ZIP.','ok');
  });
  if(kind==='rotate') $('rotateBtn').onclick=()=>run('rotateBtn',async()=>{
    const file=$('rotateFile').files[0],doc=await getPdf(file),angle=Number($('rotateAngle').value);
    doc.getPages().forEach(page=>page.setRotation(PDFLib.degrees((page.getRotation().angle+angle)%360)));
    save(new Blob([await doc.save()],{type:'application/pdf'}),safeName(file)+'-rotated.pdf');msg('Rotated PDF downloaded.','ok');
  });
  if(kind==='images') $('imagesBtn').onclick=()=>run('imagesBtn',async()=>{
    const files=[...$('imageFiles').files];if(!files.length)throw new Error('Choose one or more images.');
    const out=await PDFLib.PDFDocument.create();
    for(const file of files){
      const bytes=await file.arrayBuffer();let image;
      if(file.type==='image/jpeg'||/\.jpe?g$/i.test(file.name)) image=await out.embedJpg(bytes);
      else if(file.type==='image/png'||/\.png$/i.test(file.name)) image=await out.embedPng(bytes);
      else {
        if(!window.createImageBitmap) throw new Error('This browser cannot convert that image type. Try JPG or PNG.');
        const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not prepare image. Try JPG or PNG.');
        ctx.drawImage(bitmap,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));bitmap.close();
        if(!blob)throw new Error('Could not convert one image. Try JPG or PNG.');
        image=await out.embedPng(await blob.arrayBuffer());
      }
      const page=out.addPage([image.width,image.height]);page.drawImage(image,{x:0,y:0,width:image.width,height:image.height});
    }
    save(new Blob([await out.save()],{type:'application/pdf'}),'paperkit-images.pdf');msg('PDF created and downloaded.','ok');
  });
  if(kind==='pdfimages') $('pdfImagesBtn').onclick=()=>run('pdfImagesBtn',async()=>{
    const file=$('pdfImageFile').files[0];if(!file)throw new Error('Please select a PDF first.');
    if(!window.pdfjsLib)throw new Error('PDF rendering library did not load. Check your internet connection and reload.');
    if(!window.JSZip)throw new Error('ZIP library did not load. Check your internet connection and reload.');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    if(doc.numPages>100)throw new Error('For mobile safety, convert 100 pages or fewer at a time.');
    const zip=new JSZip();
    for(let n=1;n<=doc.numPages;n++){
      msg('Rendering page '+n+' of '+doc.numPages+'…');
      const page=await doc.getPage(n),viewport=page.getViewport({scale:1.5}),canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d');if(!context)throw new Error('Could not create image canvas.');
      await page.render({canvasContext:context,viewport}).promise;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not export a page as PNG.');
      zip.file(safeName(file)+'-page-'+String(n).padStart(3,'0')+'.png',await blob.arrayBuffer());
      canvas.width=canvas.height=1;page.cleanup();
    }
    save(await zip.generateAsync({type:'blob'}),safeName(file)+'-pages-png.zip');msg('Exported '+doc.numPages+' pages as PNGs in a ZIP.','ok');
  });
})();
