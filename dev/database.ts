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
  }

  /**
   * Atomically find and update a document matching an arbitrary filter.
   * Return null when no document matches (e.g. claim already taken).
   */
  async FindOneAndUpdateByFilter<T>(
    collection: string,
    filter: Record<string, unknown>,
    data: Record<string, unknown>,
    session?: ClientSession
  ): Promise<T | null> {
    const model = this.GetModel(collection);
    const options: mongoose.QueryOptions = { new: true };
    if (session) options.session = session;
    const result = await model
      .findOneAndUpdate(filter, data, options)
      .lean()
      .exec();
    return result ? this.StripMongoFields(result as T) : null;
  }


  /** 
   * Set (upsert) a document - creates if doesn't exist, update if exists
   */
  async Set<T>(
    collection: string,
    documentId: string,
    data: Partial<T>,
    session?: ClientSession
  ): Promise<T | null> {
    const model = this.GetModel(collection);
    const options: mongoose.QueryOptions = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    };
    if (session) options.session = session;
    const result = await model
      .findOneAndUpdate({ id: documentId }, data, options)
      .learn()
      .exec();
    return result ? this.StripMongoFields(result as T) : null;
  }
