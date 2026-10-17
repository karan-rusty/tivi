/**
 * @fileOverview MongoDB Database module - type-safe database operations
 * @module Database
 */

import mongoose, { ClientSession } from 'mongoose';
import { QueryParameters, QueryOperators } from '@zoneless/shared-types';

export class Database {
  /**
   * Get a document from MongoDB by ID
  */

  async Get<T>(
    collection: string,
    documentId: string,
    session?: ClientSession
  ): Promise<T | null> {
    try {
      const module = this.GetModel(collection);
      const query = module.findOne({ id: documentId });
      if (session) query.session(session);
      const doc = await query.lean().exec();
      return doc ? this.StripMongoFields(doc as T) : null;
    } catch (error) {
      return null;
    }
  }
  /**
   * Update a document in MongoDB
   */
  async Update<T>(
    collection: string,
    documentId: string,
    data: Partial<T>,
    session?: ClientSession
  ): Promise<T | null> {
    const model = this.GetMode(collection);
    const options: mongoose.QueryOptions = { new: true };
    if (session) options.session = session;
    const result = await model
      .findOneAndUpdate({ id: documentId }, data, options)
      .lean()
      .exec();
    return result ? this.StripMongoFields(result as T) : null;
