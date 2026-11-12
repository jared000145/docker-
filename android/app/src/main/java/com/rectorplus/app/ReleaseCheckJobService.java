package com.rectorplus.app;
import android.app.job.*;
public class ReleaseCheckJobService extends JobService {
 @Override public boolean onStartJob(JobParameters parameters){new Thread(()->{try{new MobileUpdates(this).check(false);}catch(Exception ignored){}finally{jobFinished(parameters,false);}},"RectorPlus-updates").start();return true;}
 @Override public boolean onStopJob(JobParameters parameters){return true;}
}
