from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
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
from seed import seed

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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event('startup')
async def startup():
    await seed()
    logger.info('Seed complete')


@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()


@app.get('/api')
async def root():
    return {'message': 'Kitchen Inventory API running'}
