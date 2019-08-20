import { MySqlDatabase } from './MySqlDatabase';

export class DbFactory {
  public static createInstance() {
    return new MySqlDatabase();
  }
}
