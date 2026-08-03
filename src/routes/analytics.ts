import { Router } from 'express';
import {
  getChartsOverview,
  getExpensesCategoryChart,
  getLoadsStatusChart,
  getQuotationsStatusChart,
  getRevenueTrendChart,
} from '../controllers/analyticsController.js';

const router = Router();

router.get('/overview', getChartsOverview);
router.get('/loads-status', getLoadsStatusChart);
router.get('/quotations-status', getQuotationsStatusChart);
router.get('/revenue-trend', getRevenueTrendChart);
router.get('/expenses-by-category', getExpensesCategoryChart);

export default router;
