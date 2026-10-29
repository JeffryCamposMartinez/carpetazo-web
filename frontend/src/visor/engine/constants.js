// Contrato único entre el indexador (Node) y el reconocedor (navegador): si algo de aquí cambia, el índice queda incompatible.
export const MODEL_ID = 'Xenova/dinov2-small'; // DINOv2-small (Meta), licencia Apache-2.0, export ONNX de Transformers.js
export const INPUT_SIZE = 224; // el ONNX exportado tiene posiciones fijas 224×224; la carta se estira igual en referencia y consulta
export const DIMS = 768; // CLS (384) + media de parches (384), normalizado L2
export const FORMAT = 2; // formato de los paquetes (.json/.bin)
export const QUANT_SCALE = 500; // int8 = round(x · QUANT_SCALE); |x| máx. medido 0.222 (sin recortes), ranking idéntico al float32
export const MODEL_TAG = `${MODEL_ID}@${INPUT_SIZE}x${INPUT_SIZE}/cls+mean/f${FORMAT}`;
