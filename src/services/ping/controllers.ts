import { Request, Response } from "express";

const handlePing = (req: Request, res: Response) => res.send({
	ping: `current server time is ${(new Date().toISOString())}`
});

export default handlePing;
