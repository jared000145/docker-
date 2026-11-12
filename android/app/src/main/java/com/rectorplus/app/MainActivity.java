package com.rectorplus.app;
import android.app.job.*;import android.content.ComponentName;import android.os.Bundle;
import com.getcapacitor.*;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle state){registerPlugin(RectorUpdatesPlugin.class);super.onCreate(state);JobScheduler jobs=(JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE);if(jobs!=null)jobs.schedule(new JobInfo.Builder(8302,new ComponentName(this,ReleaseCheckJobService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED).setPeriodic(15*60*1000L).setPersisted(true).build());}
 @Override protected void load(){String path=new MobileUpdates(this).prepareLaunch();if(path!=null)bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.BASE_PATH,path));super.load();}
}
