export class Payload {
  public statusCode: number;
  public data?: any | null;
  constructor(statusCode: number, data?: any | null) {
    this.statusCode = statusCode;
    this.data = data;
  }
}
