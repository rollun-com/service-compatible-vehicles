import mysql from 'mysql2';

type MySQLOptions = {
    user?: string;
    host?: string;
    database?: string;
    password?: string;
}

const makeMySQLConnectionsPool = (options: MySQLOptions = {}) => {
    const {
        user = process.env.DB_USER,
        host = process.env.DB_HOST,
        database = process.env.DB_NAME,
        password = process.env.DB_PASS
    } = options;
    const pool = mysql.createPool({
        host, user, database, password,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    return {
        _pool: pool,
        async query<T = any>(queryString: string, args?: Array<string | number>): Promise<Array<T> | T | null>  {
            return new Promise((resolve, reject) => {
                const cb = (err, result) => err ? reject(err) : resolve(result);
                args
                    ? this._pool.query(queryString, args, cb)
                    : this._pool.query(queryString, cb)
            });
        }
    }
};

export default makeMySQLConnectionsPool;
