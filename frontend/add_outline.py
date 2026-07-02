from PIL import Image, ImageFilter
import numpy as np

def add_outline(image_path, output_path, thickness=5, color=(255, 255, 255, 255)):
    # Open image
    img = Image.open(image_path).convert("RGBA")
    
    # Extract alpha channel
    alpha = img.split()[-1]
    
    # Create a mask for the outline by expanding the alpha channel
    # We can use max filter for dilation
    dilated_alpha = alpha.filter(ImageFilter.MaxFilter(thickness * 2 + 1))
    
    # Create the outline image (all white)
    outline = Image.new("RGBA", img.size, color)
    outline.putalpha(dilated_alpha)
    
    # Composite the original image over the outline
    result = Image.alpha_composite(outline, img)
    
    # Save the result
    result.save(output_path)
    print("Outline added successfully.")

if __name__ == "__main__":
    # We'll overwrite logo_completo.png
    add_outline(r"public\images\logos\logo_completo.png", r"public\images\logos\logo_completo.png")
