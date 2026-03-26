import { Router } from "express";
import { FavouritesController }  from "./favourites.controller";

export const favouritesRouter = Router();

favouritesRouter.get("/", FavouritesController.getAll);
favouritesRouter.post("/:businessId", FavouritesController.toggle);
