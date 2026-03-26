import { Router } from "express";
import { ExploreController } from "./explore.controller";

export const exploreRouter = Router();

exploreRouter.get("/", ExploreController.searchBusinesses);
