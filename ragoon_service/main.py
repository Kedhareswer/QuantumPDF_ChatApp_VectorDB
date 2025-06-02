import os
import yaml
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal
from contextlib import asynccontextmanager

# Assuming RAGoon is installed and its components are importable
# We might need to adjust imports based on RAGoon's actual structure
try:
    from ragoon import EmbeddingsDataLoader
    # If RAGoon uses sentence_transformers directly for model loading,
    # we might need to handle that.
    # from sentence_transformers import SentenceTransformer
except ImportError:
    # Mock for environments where RAGoon isn't installed, replace with actual
    print("Warning: RAGoon not found, using mock EmbeddingsDataLoader.")
    class MockEmbeddingsDataLoader:
        def __init__(self, token=None, model_configs=None, dataset=None):
            self.model_configs = model_configs
            print(f"MockEmbeddingsDataLoader initialized with models: {model_configs}")
        def load_models(self):
            print("MockEmbeddingsDataLoader: load_models() called.")
        def batch_encode(self, texts_to_embed, model_name=None): # Adjusted for single text
            print(f"MockEmbeddingsDataLoader: batch_encode for '{texts_to_embed}' with model '{model_name}'.")
            # Return a dummy embedding based on model_name or text length
            if model_name and "clip" in model_name.lower():
                return {"embedding": [0.5] * 768, "model_used": model_name, "dimensions": 768} # CLIP often 768 or 512
            return {"embedding": [0.1] * 384, "model_used": model_name or "default_mock_text_model", "dimensions": 384} # common for text
    EmbeddingsDataLoader = MockEmbeddingsDataLoader

# --- Configuration Loading ---
MODEL_CONFIG = {}
RAGOON_LOADERS: Dict[str, EmbeddingsDataLoader] = {} # Store initialized loaders

def load_model_config():
    global MODEL_CONFIG
    config_path = os.getenv("MODEL_CONFIG_PATH", "ragoon_service/model_config.yml")
    try:
        with open(config_path, 'r') as f:
            MODEL_CONFIG = yaml.safe_load(f)
        print(f"Model configuration loaded from {config_path}")
    except FileNotFoundError:
        print(f"Warning: Model config file not found at {config_path}. Using empty config.")
        MODEL_CONFIG = {"ragoon_models": [], "default_text_model": None, "default_multimodal_model": None}
    except Exception as e:
        print(f"Error loading model configuration: {e}")
        MODEL_CONFIG = {"ragoon_models": [], "default_text_model": None, "default_multimodal_model": None}


# --- FastAPI Lifespan Events (for loading models on startup) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("FastAPI app starting up...")
    load_model_config()
    if not MODEL_CONFIG.get("ragoon_models"):
        print("No models configured in model_config.yml. Embedding endpoint will not work.")
    else:
        for config in MODEL_CONFIG.get("ragoon_models", []):
            model_name_key = config.get("name")
            model_path = config.get("model_path")
            ragoon_params = config.get("params", {})

            # RAGoon's EmbeddingsDataLoader expects model_configs as a list of dicts
            # Each dict should have 'model' (for path) and other optional keys like 'query_prefix'
            loader_config = [{"model": model_path, **ragoon_params}]

            try:
                # TODO: Handle Hugging Face token if RAGoon needs it.
                # It might pick it up from env (HF_TOKEN) or need it passed.
                # token = os.getenv("HF_TOKEN")
                RAGOON_LOADERS[model_name_key] = EmbeddingsDataLoader(model_configs=loader_config)
                RAGOON_LOADERS[model_name_key].load_models() # Load models at startup
                print(f"RAGoon loader for '{model_name_key}' ({model_path}) initialized and models loaded.")
            except Exception as e:
                print(f"Error initializing RAGoon loader for {model_name_key}: {e}")
    yield
    print("FastAPI app shutting down...")
    RAGOON_LOADERS.clear()

app = FastAPI(lifespan=lifespan)

# --- Pydantic Models for Request/Response ---
class EmbeddingRequest(BaseModel):
    inputType: Literal["text", "image_url"]
    content: str
    modelName: str = None # Optional
    parameters: Dict[str, Any] = Field(default_factory=dict)

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    modelUsed: str
    dimensions: int

class HealthResponse(BaseModel):
    status: str
    message: str
    ragoon_status: Dict[str, Any] = Field(default_factory=dict)

# --- API Endpoints ---
@app.get("/health", response_model=HealthResponse)
async def health_check():
    loaded_model_names = list(RAGOON_LOADERS.keys())
    if not loaded_model_names and MODEL_CONFIG.get("ragoon_models"):
         return HealthResponse(
            status="unhealthy",
            message="RAGoon service is running, but failed to load models.",
            ragoon_status={"models_configured": len(MODEL_CONFIG.get("ragoon_models",[])), "models_loaded": loaded_model_names}
        )
    if not loaded_model_names:
        return HealthResponse(
            status="unhealthy",
            message="RAGoon service is running, but no models are configured or loaded.",
            ragoon_status={"models_loaded": loaded_model_names}
        )
    return HealthResponse(
        status="healthy",
        message="RAGoon service is running.",
        ragoon_status={"models_loaded": loaded_model_names}
    )

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest = Body(...)):
    if not RAGOON_LOADERS:
        raise HTTPException(status_code=503, detail="No RAGoon models are loaded. Service not ready.")

    target_model_name = request.modelName

    if not target_model_name:
        if request.inputType == "text":
            target_model_name = MODEL_CONFIG.get("default_text_model")
        elif request.inputType == "image_url":
            target_model_name = MODEL_CONFIG.get("default_multimodal_model")

        if not target_model_name:
            raise HTTPException(status_code=400, detail=f"No default model configured for inputType '{request.inputType}' and no modelName provided.")

    if target_model_name not in RAGOON_LOADERS:
        raise HTTPException(status_code=404, detail=f"Model configuration '{target_model_name}' not found or failed to load.")

    loader = RAGOON_LOADERS[target_model_name]

    # Find the original model_path for the target_model_name to pass to batch_encode if needed
    # RAGoon's batch_encode in the example seems to take the text directly,
    # and if multiple models are in loader, it encodes with all.
    # We've initialized loaders PER model_name_key, so each loader has one model config.
    # The `model_name` param in `batch_encode` might be for RAGoon's internal model selection
    # if a loader was configured with multiple model_configs.
    # Let's assume for now that the loader will use its configured model.

    content_to_embed = request.content
    if request.inputType == "image_url":
        # For image URLs, RAGoon (or the underlying sentence-transformer model like CLIP)
        # might expect an image path or PIL image.
        # If RAGoon's EmbeddingsDataLoader doesn't handle URLs directly for multimodal models,
        # we'd need to fetch the image here and pass the image data/path.
        # For now, assume RAGoon or the model handles the URL or we pass it as is.
        # CLIP models in sentence-transformers can often take URLs directly.
        pass # content_to_embed is already the URL

    try:
        # RAGoon's example: embedding_result = loader.batch_encode(text)
        # This implies it encodes with all models in the loader.
        # Since our loaders are 1:1 with model_name_key, this should be fine.
        # The result format needs to be known. The example shows it returns a dict
        # with the model name as key and embedding as value.
        # loader.batch_encode returns a dict like: {'bert-base-uncased': [emb], 'distilbert-base-uncased': [emb]}

        # We need to get the actual model identifier (e.g. "BAAI/bge-small-en-v1.5") that RAGoon uses internally as dict key
        original_model_config = next((m for m in MODEL_CONFIG.get("ragoon_models", []) if m["name"] == target_model_name), None)
        if not original_model_config:
             raise HTTPException(status_code=500, detail=f"Internal error: Model config details not found for {target_model_name}")

        ragoon_internal_model_key = original_model_config["model_path"]

        # The batch_encode method in the RAGoon example takes a single text string.
        # It's unclear if it returns a single embedding or a list if the input is a single string.
        # Let's assume it returns a dictionary where keys are model names and values are embeddings.
        # For a single text input, the embedding list would contain one embedding.
        # Example from RAGoon: loader.batch_encode(text) -> {'model_name': [embedding_vector]}
        # For a single text, it might be {'model_name': embedding_vector} or {'model_name': [embedding_vector]}

        # Let's simplify based on the mock: assume batch_encode returns a dict as described by the mock.
        # For a real RAGoon, we'd need to inspect its output more closely for single text inputs.

        # If using the mock EmbeddingsDataLoader, this will work.
        # If using the real RAGoon, the call might be:
        # result = loader.batch_encode(texts_to_embed=content_to_embed)
        # embedding_vector = result[ragoon_internal_model_key] # or result[ragoon_internal_model_key][0]
        # dimensions = len(embedding_vector)

        # Using the mock's simplified return for now
        mock_like_result = loader.batch_encode(content_to_embed, model_name=ragoon_internal_model_key) # Pass model_name for mock
        embedding_vector = mock_like_result["embedding"]
        actual_model_used = mock_like_result["model_used"]
        dimensions = mock_like_result["dimensions"]

        if not isinstance(embedding_vector, list) or not all(isinstance(x, (float, int)) for x in embedding_vector):
            raise ValueError("Embedding result is not a list of numbers.")

        return EmbeddingResponse(
            embedding=embedding_vector,
            modelUsed=actual_model_used, # Use the model name RAGoon reports
            dimensions=dimensions
        )
    except KeyError as e:
        print(f"KeyError during embedding: {e}. RAGoon result structure might be different than expected.")
        raise HTTPException(status_code=500, detail=f"Failed to extract embedding from RAGoon result for model {target_model_name}. Key not found: {e}")
    except ValueError as e:
        print(f"ValueError during embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Data error for embedding with {target_model_name}: {e}")
    except Exception as e:
        print(f"Error during RAGoon embedding process for model {target_model_name}: {e}")
        raise HTTPException(status_code=500, detail=f"RAGoon processing error with model {target_model_name}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # For local development, run: uvicorn ragoon_service.main:app --reload --port 8001
    # Ensure model_config.yml is in ragoon_service/ directory or set MODEL_CONFIG_PATH
    print("To run locally: uvicorn ragoon_service.main:app --reload --port 8001 --host 0.0.0.0")
    print("Ensure model_config.yml is in ragoon_service/ or MODEL_CONFIG_PATH is set.")
    # uvicorn.run(app, host="0.0.0.0", port=8001)
