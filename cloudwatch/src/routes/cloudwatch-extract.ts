import AWS from "aws-sdk";
import express from "express";
import _ from "lodash";
import moment from "moment";

import { STATUS_CODES } from "../constants/CONSTANTS.json";
import { Payload } from "../models/payload";

export class CloudwatchExtract {
  public router: express.Router;

  constructor() {
    this.router = express.Router();
    this.routes();
  }

  private routes() {
    this.router.get(
      "/extract",
      async (req: express.Request, res: express.Response) => {
        try {
          const cloudWatchLogs = new AWS.CloudWatchLogs({
            apiVersion: "2014-03-28",
            region: "ap-southeast-1",
          });
          const dateUtc = moment.utc(new Date()).format();
          const localTime = moment.utc(dateUtc).local().format().split("T");
          // const backDate = new Date(localTime);
          console.log("dateUtc: ", dateUtc);
          console.log("localTime: ", localTime);
          // console.log("backDate: ", backDate);
          // const subtractHours = (date: Date, hours: number) => {
          //   date.setHours(date.getHours() - hours);

          //   return date;
          // };

          const dateToday = new Date().toISOString().split("T");

          console.log("dateToday: ", dateToday);

          const stringToSearch = "ERROR\t[POST/eon/";
          // const st = new Date(`${localTime[0]}T00:00:00.000Z`);
          // const et = new Date(`${localTime[0]}T23:59:59.000Z`);
          // const sts = subtractHours(st, 8);
          // const ets = subtractHours(et, 8);
          // console.log("st: ", st);
          // console.log("sts: ", sts);
          // console.log("et: ", et);
          // console.log("ets: ", ets);
          const startTime = new Date(`${dateToday[0]}T00:00:00.000Z`).getTime();
          const endTime = new Date(`${dateToday[0]}T23:59:59.000Z`).getTime();
          // console.log("startTime: ", new Date(`${dateToday[0]}T00:00:00.000Z`));
          // console.log("endTime: ", new Date(`${dateToday[0]}T23:59:59.000Z`));
          const params: any = {
            endTime: endTime,
            filterPattern: `"${stringToSearch}"`,
            startTime: startTime,
            logGroupIdentifier:
              "/aws/lambda/SageProdMVPServiceStack-SageProdMVPLambda-RkONeeQdKGD3",
            limit: 2000,
          };
          let events: any,
            stopper = true;
          const eventItems: any = [];
          events = await cloudWatchLogs.filterLogEvents(params).promise();

          let count = 0;
          do {
            count++;
            console.log("count: ", count);
            events = await cloudWatchLogs.filterLogEvents(params).promise();
            eventItems.push(...events.events);
            params.nextToken = events.nextToken;
            if (events.nextToken == null) stopper = false;
          } while (stopper);

          const events3: any = [];
          eventItems
            .map((x: any) => x.message)
            .forEach((x: any) => {
              if (
                (x.includes("API Response Error") &&
                  !x.includes("accio exec") &&
                  !x.includes("[Invoke.Task.CUSTOMER_CREATE_PROFILE]") &&
                  (x.includes("TF") || x.includes("SC") || x.includes("NC"))) ||
                (x.includes("API Request Data") &&
                  !x.includes("accio exec") &&
                  !x.includes("[Invoke.Task.CUSTOMER_CREATE_PROFILE]") &&
                  (x.includes("TF") || x.includes("SC") || x.includes("NC")))
              )
                events3.push(x);
            });

          const events4: any = [];
          events3
            .map((x: any) => {
              const k = x.split("\t");
              return k;
            })
            .forEach((x: any) => {
              const z = x[3].split("|");
              let data: any;
              let header: string = "";
              z.forEach((y: any, index: number) => {
                const c = y.split(": post");
                if (
                  y.includes("API Response Error") ||
                  y.includes("API Request Data")
                )
                  header = c[0];
                else {
                  if (!y.includes("{")) {
                    data = {};
                  } else {
                    data = JSON.parse(y);
                  }
                  if (typeof data !== "object") {
                    data = JSON.parse(data);
                  }
                }
              });

              const v = new Date(x[0]).toString().split(".");
              const dateUtc = moment.utc(new Date(v[0])).format();
              events4.push({
                timeStamp: dateUtc,
                requestId: x[1],
                [header]: data,
              });
            });

          const groupedByRequestId = _.mapValues(
            _.groupBy(events4, "requestId"),
            (elist) => elist.map((e) => _.omit(e, "requestId"))
          );

          const groupedByRequestIdKeys = Object.keys(groupedByRequestId);

          const result: any = [];
          groupedByRequestIdKeys.forEach(
            (requestIdKey: string, index: number) => {
              const groupByTimeStamp: any = _.mapValues(
                _.groupBy(groupedByRequestId[requestIdKey], "timeStamp"),
                (elist) => elist.map((e) => _.omit(e, "timeStamp"))
              );
              const groupByTimeStampKeys: any = Object.keys(groupByTimeStamp);
              const dateUtc = moment
                .utc(new Date(groupByTimeStampKeys[0]))
                .format();
              const localTime = moment.utc(dateUtc).local().format();
              result.push({
                requestId: requestIdKey,
                timeStamp: localTime,
                data: groupByTimeStamp[groupByTimeStampKeys[0]],
              });
            }
          );

          const payload: Payload = new Payload(
            STATUS_CODES.SUCCESSFUL_RESPONSE.OK,
            result
          );

          res.status(payload.statusCode).send(payload);
        } catch (err: any) {
          console.log("ERR is: ", err);
          if (err.statusCode) res.status(err.statusCode).send(err);
          else res.send(err);
        }
      }
    );
  }
}
