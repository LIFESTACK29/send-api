import { Response } from "express";

const responseUtil = (
    res: Response,
    status: number,
    message: string,
    data: any = null
) => {
    res.status(status).json({ message, data });
};

export default responseUtil;
