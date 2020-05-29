import {Request}       from 'express';
import { AxiosStatic } from "axios";
import ElasticLogger   from "../logger/elastic-logger";

export interface RequestWithAddons extends Request {
	axios: AxiosStatic,
	logger: ElasticLogger
}
