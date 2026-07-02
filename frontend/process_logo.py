from PIL import Image

def process_logo(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    width, height = img.size
    pixels = img.load()
    
    def is_bg(c):
        return c[0] < 20 and c[1] < 20 and c[2] < 20
        
    visited = set()
    queue = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    transparent = (0, 0, 0, 0)
    
    for start_node in queue:
        if start_node in visited:
            continue
            
        local_q = [start_node]
        while local_q:
            x, y = local_q.pop()
            if (x, y) in visited:
                continue
                
            visited.add((x, y))
            c = pixels[x, y]
            
            if is_bg(c):
                pixels[x, y] = transparent
                if x > 0: local_q.append((x-1, y))
                if x < width - 1: local_q.append((x+1, y))
                if y > 0: local_q.append((x, y-1))
                if y < height - 1: local_q.append((x, y+1))
                
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path)
    print("Logo processed and cropped successfully.")

if __name__ == "__main__":
    process_logo(r"public\images\logos\logo_completo.png", r"public\images\logos\logo_completo.png")
