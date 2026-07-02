import rembg
from PIL import Image

def process_logo_ai(input_path, output_path):
    # Open the image
    img = Image.open(input_path)
    
    # Remove background using rembg
    output = rembg.remove(img)
    
    # Auto-crop to bounding box
    bbox = output.getbbox()
    if bbox:
        output = output.crop(bbox)
        
    # Save the result
    output.save(output_path)
    print("AI background removal and crop successful.")

if __name__ == "__main__":
    process_logo_ai(r"c:\Users\Jeffry\Desktop\Publicar mis cartas\imagenes referencia\WhatsApp Image 2026-07-02 at 4.05.03 AM.jpeg", r"c:\Users\Jeffry\Desktop\Publicar mis cartas\frontend\public\images\logos\logo_completo.png")
