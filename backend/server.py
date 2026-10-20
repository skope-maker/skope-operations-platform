from dotenv import load_dotenv
load_dotenv()

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import logging

from db import client
from auth import router as auth_router, users_router
from routers_masters import router as masters_router
from routers_procurement import router as procurement_router, inv_router
from routers_kitchen import router as kitchen_router, wastage_router, rd_router
from routers_recipes import router as recipes_router
from routers_sales import router as sales_router
from routers_closing import router as closing_router
from routers_reports import router as reports_router
from routers_bulk import router as bulk_router
from routers_admin import router as admin_router
from routers_files import router as files_router
from routers_rista import router as rista_router, ensure_indexes as rista_indexes
from storage import init_storage
from seed import seed

# Comma-separated list of allowed website origins. '*' (any) is the default for local development;
# on a public deployment set CORS_ORIGINS to your own address.
CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()] or ['*']

app = FastAPI(title='Kitchen Inventory & Recipe Management')
API = '/api'

app.include_router(auth_router, prefix=API)
app.include_router(users_router, prefix=API)
app.include_router(masters_router, prefix=API)
app.include_router(procurement_router, prefix=API)
app.include_router(inv_router, prefix=API)
app.include_router(kitchen_router, prefix=API)
app.include_router(wastage_router, prefix=API)
app.include_router(rd_router, prefix=API)
app.include_router(recipes_router, prefix=API)
app.include_router(sales_router, prefix=API)
app.include_router(closing_router, prefix=API)
app.include_router(reports_router, prefix=API)
app.include_router(bulk_router, prefix=API)
app.include_router(admin_router, prefix=API)
app.include_router(files_router, prefix=API)
app.include_router(rista_router, prefix=API)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=CORS_ORIGINS,
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event('startup')
async def startup():
    await seed()
    logger.info('Seed complete')
    try:
        await rista_indexes()
    except Exception as e:
        logger.error(f'Rista index setup failed: {e}')
    try:
        await init_storage()
        logger.info('Object storage initialized')
    except Exception as e:
        logger.error(f'Object storage init failed: {e}')


@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()


@app.get('/api')
async def root():
    return {'message': 'Kitchen Inventory API running'}


# Serve the built React app from the same address as the API (single-service deployment).
# Used when frontend/build exists (or FRONTEND_DIST points at it); local development
# keeps using the Vite dev server and never needs this.
FRONTEND_DIST = Path(os.environ.get('FRONTEND_DIST') or Path(__file__).resolve().parent.parent / 'frontend' / 'build')
if (FRONTEND_DIST / 'index.html').is_file():
    if (FRONTEND_DIST / 'assets').is_dir():
        app.mount('/assets', StaticFiles(directory=FRONTEND_DIST / 'assets'), name='assets')

    @app.get('/{full_path:path}', include_in_schema=False)
    async def serve_frontend(full_path: str):
        if full_path == 'api' or full_path.startswith('api/'):
            raise HTTPException(404, 'Not found')
        target = (FRONTEND_DIST / full_path).resolve()
        if full_path and FRONTEND_DIST.resolve() in target.parents and target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / 'index.html')
